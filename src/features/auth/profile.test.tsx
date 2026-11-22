import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { BASE, errorEnvelope, makeAuthedHandlers, testUser } from '../../../test/msw/api'
import { server } from '../../../test/msw/server'
import { renderApp } from '../../../test/renderApp'
import { supportedTimezones } from './ProfileScreen'

describe('timezones', () => {
  it('offers a searchable IANA list', () => {
    const zones = supportedTimezones()
    expect(zones.length).toBeGreaterThan(100)
    expect(zones).toContain('Asia/Jakarta')
  })
})

describe('profile', () => {
  beforeEach(() => server.use(...makeAuthedHandlers()))

  it('saves a new name and timezone, and the app reflects it', async () => {
    let body: unknown
    server.use(
      http.patch(`${BASE}/me`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ ...testUser, ...(body as object) })
      }),
    )
    const user = userEvent.setup()
    renderApp('/settings/profile')
    const name = await screen.findByLabelText('Name')
    expect(screen.getByLabelText('Email')).toHaveAttribute('readonly')
    const save = screen.getByRole('button', { name: 'Save profile' })
    expect(save).toBeDisabled()
    await user.clear(name)
    await user.type(name, 'Janet')
    const tz = screen.getByLabelText('Timezone')
    await user.clear(tz)
    await user.type(tz, 'Europe/London')
    await user.click(save)
    await waitFor(() => expect(body).toEqual({ name: 'Janet', timezone: 'Europe/London' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save profile' })).toBeDisabled())
  })

  it('rejects a timezone that is not in the list, without calling the server', async () => {
    const called = vi.fn()
    server.use(
      http.patch(`${BASE}/me`, () => {
        called()
        return HttpResponse.json(testUser)
      }),
    )
    const user = userEvent.setup()
    renderApp('/settings/profile')
    const tz = await screen.findByLabelText('Timezone')
    await user.clear(tz)
    await user.type(tz, 'Mars/Olympus')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(await screen.findByText('Choose a timezone from the list')).toBeInTheDocument()
    expect(called).not.toHaveBeenCalled()
  })

  it('puts a wrong current password inline on that field', async () => {
    server.use(
      http.post(`${BASE}/auth/change-password`, () =>
        HttpResponse.json(errorEnvelope('INVALID_CURRENT_PASSWORD'), { status: 422 }),
      ),
    )
    const user = userEvent.setup()
    renderApp('/settings/profile')
    await user.type(await screen.findByLabelText('Current password'), 'wrong one')
    await user.type(screen.getByLabelText('New password'), 'brand new pass')
    await user.type(screen.getByLabelText('Confirm new password'), 'brand new pass')
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    expect(await screen.findByText('Your current password is incorrect.')).toBeInTheDocument()
  })

  it('changes the password, stays signed in, and clears the form', async () => {
    let body: unknown
    let refreshes = 0
    server.use(
      http.post(`${BASE}/auth/change-password`, async ({ request }) => {
        body = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
      http.post(`${BASE}/auth/refresh`, () => {
        refreshes++
        return HttpResponse.json({ accessToken: 'tok-2', expiresIn: 900, user: testUser })
      }),
    )
    const user = userEvent.setup()
    renderApp('/settings/profile')
    await user.type(await screen.findByLabelText('Current password'), 'old password')
    await user.type(screen.getByLabelText('New password'), 'brand new pass')
    await user.type(screen.getByLabelText('Confirm new password'), 'brand new pass')
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    await waitFor(() =>
      expect(body).toEqual({ currentPassword: 'old password', newPassword: 'brand new pass' }),
    )
    // The session is re-checked after the server revokes the other sessions.
    await waitFor(() => expect(refreshes).toBeGreaterThanOrEqual(2)) // boot + post-change
    expect(screen.getByLabelText('Current password')).toHaveValue('')
    expect(screen.queryByRole('heading', { name: 'Welcome back' })).not.toBeInTheDocument()
  })

  it('signs out to the login screen if the session did not survive the change', async () => {
    let refreshes = 0
    server.use(
      http.post(`${BASE}/auth/change-password`, () => new HttpResponse(null, { status: 204 })),
      http.post(`${BASE}/auth/refresh`, () => {
        refreshes++
        return refreshes === 1
          ? HttpResponse.json({ accessToken: 'tok-1', expiresIn: 900, user: testUser })
          : HttpResponse.json(errorEnvelope('REFRESH_TOKEN_INVALID'), { status: 401 })
      }),
    )
    const user = userEvent.setup()
    renderApp('/settings/profile')
    await user.type(await screen.findByLabelText('Current password'), 'old password')
    await user.type(screen.getByLabelText('New password'), 'brand new pass')
    await user.type(screen.getByLabelText('Confirm new password'), 'brand new pass')
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })

  it('requires matching new passwords of at least 8 characters', async () => {
    const user = userEvent.setup()
    renderApp('/settings/profile')
    await user.type(await screen.findByLabelText('Current password'), 'x')
    await user.type(screen.getByLabelText('New password'), 'short')
    await user.type(screen.getByLabelText('Confirm new password'), 'different')
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    expect(await screen.findByText('Use at least 8 characters')).toBeInTheDocument()
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
  })
})
