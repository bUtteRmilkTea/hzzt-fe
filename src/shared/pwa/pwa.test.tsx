import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { api } from '@/shared/api/client'
import { AppError, ERROR_COPY, errorMessage } from '@/shared/api/errors'
import { authedHandlers, BASE } from '../../../test/msw/api'
import { server } from '../../../test/msw/server'
import { cash, walletList } from '../../../test/msw/wallets'
import { renderApp } from '../../../test/renderApp'
import { OfflineBanner } from './OfflineBanner'
import { isOffline } from './online'
import { UpdatePrompt } from './UpdatePrompt'

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
  window.dispatchEvent(new Event(value ? 'online' : 'offline'))
}

afterEach(() => setOnline(true))

describe('offline banner', () => {
  it('is absent while online, and appears and disappears as the connection changes', async () => {
    render(<OfflineBanner />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    act(() => setOnline(false))
    expect(await screen.findByRole('status')).toHaveTextContent("You're offline")
    expect(screen.getByRole('status')).toHaveTextContent('changes need a connection')
    act(() => setOnline(true))
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })

  it('isOffline follows navigator.onLine', () => {
    expect(isOffline()).toBe(false)
    setOnline(false)
    expect(isOffline()).toBe(true)
  })
})

describe('offline writes are blocked, not queued', () => {
  it('refuses a write with a clear message and never sends the request', async () => {
    const sent = vi.fn()
    server.use(
      http.post(`${BASE}/auth/login`, () => {
        sent()
        return HttpResponse.json({})
      }),
    )
    setOnline(false)
    const err = await api
      .POST('/auth/login', { body: { email: 'a@b.co', password: 'x' } })
      .catch((e) => e)
    expect(err).toBeInstanceOf(AppError)
    expect(err.code).toBe('OFFLINE')
    expect(errorMessage(err)).toBe(ERROR_COPY.OFFLINE)
    expect(errorMessage(err)).toBe("You're offline. Reconnect to save changes.")
    expect(sent).not.toHaveBeenCalled()
  })

  it('still lets reads through, so cached screens keep working', async () => {
    server.use(http.get(`${BASE}/currencies`, () => HttpResponse.json([{ code: 'IDR' }])))
    setOnline(false)
    const res = await api.GET('/currencies')
    expect(res.data).toEqual([{ code: 'IDR' }])
  })

  it('a form shows the offline message in plain words', async () => {
    const user = userEvent.setup()
    renderApp('/login')
    setOnline(false)
    await user.type(await screen.findByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct horse')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(
      await screen.findByText("You're offline. Reconnect to save changes."),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/You're offline\. You can read what's already loaded/),
    ).toBeInTheDocument()
  })

  it('a read-only screen keeps showing what is already loaded after the connection drops', async () => {
    server.use(...authedHandlers)
    server.use(http.get(`${BASE}/spaces/s-1/wallets`, () => HttpResponse.json(walletList([cash]))))
    renderApp('/s/s-1/wallets')
    expect(await screen.findByRole('link', { name: /Cash.*open wallet/ })).toBeInTheDocument()
    act(() => setOnline(false))
    expect(
      await screen.findByText(/You're offline\. You can read what's already loaded/),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Cash.*open wallet/ })).toBeInTheDocument() // served from the query cache
  })
})

describe('update prompt', () => {
  it('is hidden until a new version (or a stale chunk) is detected', async () => {
    render(<UpdatePrompt />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('a failed chunk load offers an update instead of breaking, and reloads on request', async () => {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload },
      configurable: true,
    })
    const user = userEvent.setup()
    render(<UpdatePrompt />)
    const event = new Event('vite:preloadError', { cancelable: true })
    act(() => {
      window.dispatchEvent(event)
    })
    expect(event.defaultPrevented).toBe(true) // the default (an unhandled error) is suppressed
    expect(await screen.findByRole('alert')).toHaveTextContent('A new version is available.')
    await user.click(screen.getByRole('button', { name: 'Update' }))
    expect(reload).toHaveBeenCalled()
  })
})
