import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { BASE, defaultPreferences, errorEnvelope, makeAuthedHandlers } from '../../../test/msw/api'
import { server } from '../../../test/msw/server'
import { renderApp } from '../../../test/renderApp'
import { formatCountdown, isValidPin, retryAfterSeconds } from './pin'

describe('pin helpers', () => {
  it('accepts 4 to 6 digits only', () => {
    expect(isValidPin('1234')).toBe(true)
    expect(isValidPin('123456')).toBe(true)
    for (const bad of ['123', '1234567', '12a4', '', ' 1234']) expect(isValidPin(bad)).toBe(false)
  })
  it('reads retryAfter from details and formats a countdown', () => {
    expect(retryAfterSeconds({ retryAfter: 287 })).toBe(287)
    expect(retryAfterSeconds({ retryAfter: 1.2 })).toBe(2)
    expect(retryAfterSeconds({})).toBeNull()
    expect(retryAfterSeconds({ retryAfter: 'x' })).toBeNull()
    expect(formatCountdown(287)).toBe('4:47')
    expect(formatCountdown(9)).toBe('0:09')
  })
})

describe('settings index', () => {
  beforeEach(() => server.use(...makeAuthedHandlers()))

  it('lists every supported item', async () => {
    renderApp('/settings')
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    for (const label of ['Profile', 'Space', 'Categories', 'Goals', 'Currency', 'App lock']) {
      expect(screen.getByRole('link', { name: new RegExp(label) })).toBeInTheDocument()
    }
    expect(screen.getByRole('switch', { name: 'Hide amounts' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Keyboard type' })).toBeInTheDocument()
    expect(screen.getByText(/HZZT v/)).toBeInTheDocument()
  })

  it('shows the current app lock state', async () => {
    server.use(
      ...makeAuthedHandlers({ preferences: { ...defaultPreferences, appLockEnabled: false } }),
    )
    renderApp('/settings')
    expect(await screen.findByRole('link', { name: /App lock.*Off/ })).toBeInTheDocument()
  })
})

describe('hide amounts', () => {
  it('applies optimistically, then the eye toggle reveals for this session only', async () => {
    let patched: unknown
    server.use(
      http.patch(`${BASE}/me/preferences`, async ({ request }) => {
        patched = await request.json()
        return HttpResponse.json({ ...defaultPreferences, hideAmounts: true })
      }),
      ...makeAuthedHandlers(),
    )
    const user = userEvent.setup()
    renderApp('/settings')
    expect(screen.queryByRole('button', { name: 'Show amounts' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('switch', { name: 'Hide amounts' }))
    expect(screen.getByRole('switch', { name: 'Hide amounts' })).toBeChecked() // before the server replies
    await waitFor(() => expect(patched).toEqual({ hideAmounts: true }))

    const eye = await screen.findByRole('button', { name: 'Show amounts' })
    await user.click(eye)
    expect(screen.getByRole('button', { name: 'Hide amounts' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // The stored preference is untouched by revealing.
    expect(screen.getByRole('switch', { name: 'Hide amounts' })).toBeChecked()
  })

  it('rolls back and tells the user when the server rejects it', async () => {
    server.use(
      http.patch(`${BASE}/me/preferences`, () =>
        HttpResponse.json(errorEnvelope('INTERNAL_ERROR'), { status: 500 }),
      ),
      ...makeAuthedHandlers(),
    )
    const user = userEvent.setup()
    renderApp('/settings')
    const sw = await screen.findByRole('switch', { name: 'Hide amounts' })
    await user.click(sw)
    await waitFor(() => expect(sw).not.toBeChecked())
  })

  it('starts masked when the stored preference is on', async () => {
    server.use(...makeAuthedHandlers({ preferences: { ...defaultPreferences, hideAmounts: true } }))
    renderApp('/settings')
    expect(await screen.findByRole('button', { name: 'Show amounts' })).toBeInTheDocument()
  })
})

describe('keyboard type', () => {
  it('saves the choice', async () => {
    let patched: unknown
    server.use(
      http.patch(`${BASE}/me/preferences`, async ({ request }) => {
        patched = await request.json()
        return HttpResponse.json({ ...defaultPreferences, keyboardType: 'STANDARD_NUMERIC' })
      }),
      ...makeAuthedHandlers(),
    )
    const user = userEvent.setup()
    renderApp('/settings')
    await user.click(await screen.findByRole('radio', { name: 'Standard' }))
    await waitFor(() => expect(patched).toEqual({ keyboardType: 'STANDARD_NUMERIC' }))
    expect(screen.getByRole('radio', { name: 'Standard' })).toBeChecked()
  })
})

describe('app lock gate', () => {
  const locked = { ...defaultPreferences, appLockEnabled: true }

  async function pressPin(user: ReturnType<typeof userEvent.setup>, pin: string) {
    const gate = screen.getByRole('dialog', { name: 'App locked' })
    for (const d of pin) await user.click(within(gate).getByRole('button', { name: d }))
    await user.click(within(gate).getByRole('button', { name: 'Unlock' }))
  }

  it('shows on boot, blocks the content, and unlocks with the right PIN', async () => {
    server.use(
      http.post(`${BASE}/me/app-lock/verify`, async ({ request }) => {
        const { pin } = (await request.json()) as { pin: string }
        return HttpResponse.json({ valid: pin === '1234' })
      }),
      ...makeAuthedHandlers({ preferences: locked }),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1')
    expect(await screen.findByRole('dialog', { name: 'App locked' })).toBeInTheDocument()
    // The screen behind is inert, so nothing in it can be reached or read.
    expect(document.querySelector('[inert]')).toBeInTheDocument()
    expect(screen.getByText(/guards the screen on this device/)).toBeInTheDocument()

    await pressPin(user, '9999')
    expect(await screen.findByText('That PIN is incorrect.')).toBeInTheDocument()

    await pressPin(user, '1234')
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'App locked' })).not.toBeInTheDocument(),
    )
    expect(document.querySelector('[inert]')).not.toBeInTheDocument()
  })

  it('keeps Unlock disabled until the PIN has at least 4 digits', async () => {
    server.use(...makeAuthedHandlers({ preferences: locked }))
    const user = userEvent.setup()
    renderApp('/s/s-1')
    const gate = await screen.findByRole('dialog', { name: 'App locked' })
    const unlock = within(gate).getByRole('button', { name: 'Unlock' })
    expect(unlock).toBeDisabled()
    for (const d of '123') await user.click(within(gate).getByRole('button', { name: d }))
    expect(unlock).toBeDisabled()
    await user.click(within(gate).getByRole('button', { name: '4' }))
    expect(unlock).toBeEnabled()
  })

  it("after repeated wrong PINs, shows the server's retryAfter as the countdown", async () => {
    let attempts = 0
    server.use(
      http.post(`${BASE}/me/app-lock/verify`, () => {
        attempts++
        // 5 wrong PINs are answered normally; the 6th is locked out for 287s by the server.
        return attempts <= 5
          ? HttpResponse.json({ valid: false })
          : HttpResponse.json(
              errorEnvelope('APP_LOCK_TEMPORARILY_LOCKED', '', { retryAfter: 287 }),
              { status: 429 },
            )
      }),
      ...makeAuthedHandlers({ preferences: locked }),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1')
    await screen.findByRole('dialog', { name: 'App locked' })
    for (let i = 0; i < 5; i++) {
      await pressPin(user, '0000')
      await screen.findByText('That PIN is incorrect.')
    }
    await pressPin(user, '0000')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Too many wrong PINs')
    // 287s -> 4:47, straight from the server's number.
    expect(alert).toHaveTextContent(/4:4[67]/)
    const gate = screen.getByRole('dialog', { name: 'App locked' })
    expect(within(gate).getByRole('button', { name: 'Unlock' })).toBeDisabled()
    expect(within(gate).getByRole('button', { name: '1' })).toBeDisabled()
    expect(attempts).toBe(6)
  })

  it('locks again when the tab becomes visible', async () => {
    server.use(
      http.post(`${BASE}/me/app-lock/verify`, () => HttpResponse.json({ valid: true })),
      ...makeAuthedHandlers({ preferences: locked }),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1')
    await screen.findByRole('dialog', { name: 'App locked' })
    await pressPin(user, '1234')
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'App locked' })).not.toBeInTheDocument(),
    )

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(await screen.findByRole('dialog', { name: 'App locked' })).toBeInTheDocument()
  })

  it('never shows when app lock is off', async () => {
    server.use(...makeAuthedHandlers())
    renderApp('/s/s-1')
    await screen.findByTestId('active-space')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(screen.queryByRole('dialog', { name: 'App locked' })).not.toBeInTheDocument()
  })
})

describe('app lock settings', () => {
  it('turns app lock on with a password and matching PIN', async () => {
    let body: unknown
    let enabled = false
    server.use(
      http.post(`${BASE}/me/app-lock`, async ({ request }) => {
        body = await request.json()
        enabled = true
        return new HttpResponse(null, { status: 204 })
      }),
      http.get(`${BASE}/me/preferences`, () =>
        HttpResponse.json({ ...defaultPreferences, appLockEnabled: enabled }),
      ),
      ...makeAuthedHandlers(),
    )
    const user = userEvent.setup()
    renderApp('/settings/security')
    await user.click(await screen.findByRole('switch', { name: 'App lock' }))
    const sheet = await screen.findByRole('dialog', { name: 'Turn on app lock' })
    await user.type(within(sheet).getByLabelText('Account password'), 'correct horse')
    for (const d of '2468') await user.click(within(sheet).getByRole('button', { name: d }))
    await user.type(within(sheet).getByLabelText('Confirm PIN'), '2468')
    await user.click(within(sheet).getByRole('button', { name: 'Turn on' }))
    await waitFor(() => expect(body).toEqual({ password: 'correct horse', pin: '2468' }))
    await waitFor(() => expect(screen.getByRole('switch', { name: 'App lock' })).toBeChecked())
    expect(screen.getByText(/does not encrypt your data/)).toBeInTheDocument()
  })

  it('rejects mismatched or too-short PINs before calling the server', async () => {
    const called = vi.fn()
    server.use(
      http.post(`${BASE}/me/app-lock`, () => {
        called()
        return new HttpResponse(null, { status: 204 })
      }),
      ...makeAuthedHandlers(),
    )
    const user = userEvent.setup()
    renderApp('/settings/security')
    await user.click(await screen.findByRole('switch', { name: 'App lock' }))
    const sheet = await screen.findByRole('dialog', { name: 'Turn on app lock' })
    await user.type(within(sheet).getByLabelText('Account password'), 'pw')
    for (const d of '12') await user.click(within(sheet).getByRole('button', { name: d }))
    await user.click(within(sheet).getByRole('button', { name: 'Turn on' }))
    expect(await within(sheet).findByText('Use 4 to 6 digits')).toBeInTheDocument()
    for (const d of '34') await user.click(within(sheet).getByRole('button', { name: d }))
    await user.type(within(sheet).getByLabelText('Confirm PIN'), '9999')
    await user.click(within(sheet).getByRole('button', { name: 'Turn on' }))
    expect(await within(sheet).findByText('PINs do not match')).toBeInTheDocument()
    expect(called).not.toHaveBeenCalled()
  })

  it('shows a wrong password in plain words when turning it off', async () => {
    server.use(
      http.delete(`${BASE}/me/app-lock`, () =>
        HttpResponse.json(errorEnvelope('INVALID_CURRENT_PASSWORD'), { status: 422 }),
      ),
      ...makeAuthedHandlers({ preferences: { ...defaultPreferences, appLockEnabled: true } }),
    )
    const user = userEvent.setup()
    renderApp('/settings/security')
    // Unlock the gate first (boot lock) by verifying.
    server.use(http.post(`${BASE}/me/app-lock/verify`, () => HttpResponse.json({ valid: true })))
    const gate = await screen.findByRole('dialog', { name: 'App locked' })
    for (const d of '1234') await user.click(within(gate).getByRole('button', { name: d }))
    await user.click(within(gate).getByRole('button', { name: 'Unlock' }))
    await user.click(await screen.findByRole('switch', { name: 'App lock' }))
    const sheet = await screen.findByRole('dialog', { name: 'Turn off app lock' })
    await user.type(within(sheet).getByLabelText('Account password'), 'wrong')
    await user.click(within(sheet).getByRole('button', { name: 'Turn off' }))
    expect(await within(sheet).findByRole('alert')).toHaveTextContent(
      'Your current password is incorrect.',
    )
  })
})
