import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { StrictMode } from 'react'
import { App } from '@/app/App'
import { Providers } from '@/app/providers/Providers'
import { createAppRouter } from '@/app/router'
import { ERROR_COPY } from '@/shared/api/errors'
import { authedHandlers, authResponse, BASE, errorEnvelope } from '../../../test/msw/api'
import { server } from '../../../test/msw/server'
import { renderApp } from '../../../test/renderApp'

describe('session boot', () => {
  it('shows the splash, then the login screen when signed out', async () => {
    renderApp('/')
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })

  it('never renders the login screen when a session can be restored (no flash)', async () => {
    server.use(...authedHandlers)
    const seen: string[] = []
    const observer = new MutationObserver(() => {
      if (document.body.textContent?.includes('Welcome back')) seen.push('login')
    })
    observer.observe(document.body, { childList: true, subtree: true })
    renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument()
    observer.disconnect()
    expect(seen).toEqual([])
  })

  it('boots with exactly one refresh even under StrictMode double effects', async () => {
    let refreshCalls = 0
    // The counting handler must come first: MSW uses the first match.
    server.use(
      http.post(`${BASE}/auth/refresh`, () => {
        refreshCalls++
        return HttpResponse.json(authResponse)
      }),
      ...authedHandlers,
    )
    const router = createAppRouter(createMemoryHistory({ initialEntries: ['/'] }))
    render(
      <StrictMode>
        <Providers>
          <App router={router} />
        </Providers>
      </StrictMode>,
    )
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument()
    expect(refreshCalls).toBe(1)
  })
})

describe('route guards', () => {
  it('sends a signed-out user to /login and keeps the attempted path', async () => {
    const { router } = renderApp('/s/s-1/history')
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toMatchObject({ redirect: '/s/s-1/history' })
  })

  it('lands on the attempted page after signing in', async () => {
    server.use(
      http.post(`${BASE}/auth/login`, () => HttpResponse.json(authResponse)),
      http.get(`${BASE}/me`, () => HttpResponse.json(authResponse.user)),
      ...authedHandlers.filter((h) => !String(h.info.path).endsWith('/auth/refresh')),
    )
    const user = userEvent.setup()
    const { router } = renderApp('/s/s-1/history')
    await user.type(await screen.findByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct horse')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: 'History' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/s/s-1/history')
  })

  it('never redirects a signed-in user to an off-site target', async () => {
    server.use(...authedHandlers)
    const { router } = renderApp('/login?redirect=//evil.example')
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/s/s-1')
    expect(router.state.location.href).not.toContain('evil')
  })
})

describe('login', () => {
  it('shows a friendly sentence, not a code, for INVALID_CREDENTIALS', async () => {
    server.use(
      http.post(`${BASE}/auth/login`, () =>
        HttpResponse.json(errorEnvelope('INVALID_CREDENTIALS'), { status: 401 }),
      ),
    )
    const user = userEvent.setup()
    renderApp('/login')
    await user.type(await screen.findByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(ERROR_COPY.INVALID_CREDENTIALS as string)
    expect(document.body.textContent).not.toContain('INVALID_CREDENTIALS')
  })

  it('validates client-side before sending anything', async () => {
    let called = false
    server.use(
      http.post(`${BASE}/auth/login`, () => {
        called = true
        return HttpResponse.json(authResponse)
      }),
    )
    const user = userEvent.setup()
    renderApp('/login')
    await user.click(await screen.findByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(screen.getByText('Enter your password')).toBeInTheDocument()
    expect(called).toBe(false)
  })

  it('stores the token nowhere in browser storage', async () => {
    server.use(
      http.post(`${BASE}/auth/login`, () => HttpResponse.json(authResponse)),
      ...authedHandlers.filter((h) => !String(h.info.path).endsWith('/auth/refresh')),
    )
    const user = userEvent.setup()
    renderApp('/login')
    await user.type(await screen.findByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct horse')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await screen.findByRole('heading', { name: 'Home' })
    const dump = JSON.stringify({ ...localStorage, ...sessionStorage })
    expect(dump).not.toContain(authResponse.accessToken)
  })
})

describe('register', () => {
  it('sends the browser timezone and signs the user in', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post(`${BASE}/auth/register`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(authResponse, { status: 201 })
      }),
      ...authedHandlers.filter((h) => !String(h.info.path).endsWith('/auth/refresh')),
    )
    const user = userEvent.setup()
    renderApp('/register')
    await user.type(await screen.findByLabelText('Name'), 'Jane')
    await user.type(screen.getByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct horse')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument()
    expect(body.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
    expect(body).toMatchObject({ name: 'Jane', email: 'jane@example.com' })
  })

  it('maps server field errors onto the fields', async () => {
    server.use(
      http.post(`${BASE}/auth/register`, () =>
        HttpResponse.json(
          errorEnvelope('VALIDATION_FAILED', 'Validation failed', {
            Email: 'must be a valid email address',
          }),
          { status: 400 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderApp('/register')
    await user.type(await screen.findByLabelText('Name'), 'Jane')
    await user.type(screen.getByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct horse')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('must be a valid email address')).toBeInTheDocument()
  })

  it('explains a duplicate email in plain words', async () => {
    server.use(
      http.post(`${BASE}/auth/register`, () =>
        HttpResponse.json(errorEnvelope('EMAIL_ALREADY_REGISTERED'), { status: 409 }),
      ),
    )
    const user = userEvent.setup()
    renderApp('/register')
    await user.type(await screen.findByLabelText('Name'), 'Jane')
    await user.type(screen.getByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct horse')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      ERROR_COPY.EMAIL_ALREADY_REGISTERED as string,
    )
  })

  it('rejects a password equal to the email and a short password', async () => {
    const user = userEvent.setup()
    renderApp('/register')
    await user.type(await screen.findByLabelText('Name'), 'Jane')
    await user.type(screen.getByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'jane@example.com')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('Password cannot be the same as your email')).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Password'))
    await user.type(screen.getByLabelText('Password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('Use at least 8 characters')).toBeInTheDocument()
  })
})

describe('forgot and reset password', () => {
  it('shows the same confirmation whether or not the account exists', async () => {
    server.use(
      http.post(`${BASE}/auth/forgot-password`, () => HttpResponse.json({ message: 'ok' })),
    )
    const user = userEvent.setup()
    renderApp('/forgot-password')
    await user.type(await screen.findByLabelText('Email'), 'nobody@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
  })

  it('resets with the emailed token and returns to sign in', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post(`${BASE}/auth/reset-password`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    renderApp('/reset-password?token=abc123')
    await user.type(await screen.findByLabelText('New password'), 'brand new pass')
    await user.type(screen.getByLabelText('Confirm password'), 'brand new pass')
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(body).toEqual({ token: 'abc123', newPassword: 'brand new pass' })
  })

  it('explains an expired reset link in plain words', async () => {
    server.use(
      http.post(`${BASE}/auth/reset-password`, () =>
        HttpResponse.json(errorEnvelope('RESET_TOKEN_INVALID'), { status: 422 }),
      ),
    )
    const user = userEvent.setup()
    renderApp('/reset-password?token=old')
    await user.type(await screen.findByLabelText('New password'), 'brand new pass')
    await user.type(screen.getByLabelText('Confirm password'), 'brand new pass')
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      ERROR_COPY.RESET_TOKEN_INVALID as string,
    )
  })

  it('requires matching passwords', async () => {
    const user = userEvent.setup()
    renderApp('/reset-password?token=abc')
    await user.type(await screen.findByLabelText('New password'), 'brand new pass')
    await user.type(screen.getByLabelText('Confirm password'), 'different pass')
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
  })

  it('handles a missing token', async () => {
    renderApp('/reset-password')
    expect(await screen.findByRole('heading', { name: 'Link not valid' })).toBeInTheDocument()
  })
})

describe('session expiry', () => {
  it('routes to /login when a refresh fails mid-session, without an error', async () => {
    server.use(...authedHandlers)
    const { router } = renderApp('/')
    await screen.findByRole('heading', { name: 'Home' })
    // Later requests are prepended, so these now win: the token is rejected and refresh fails.
    server.use(
      http.get(`${BASE}/me`, () =>
        HttpResponse.json(errorEnvelope('UNAUTHENTICATED'), { status: 401 }),
      ),
      http.post(`${BASE}/auth/refresh`, () =>
        HttpResponse.json(errorEnvelope('REFRESH_TOKEN_INVALID'), { status: 401 }),
      ),
    )
    const { api } = await import('@/shared/api/client')
    await api.GET('/me').catch(() => undefined)
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    // A 401 renders no error, it just routes to /login.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('auth split layout (F20)', () => {
  it.each([
    ['/login', 'Welcome back'],
    ['/register', /Create/],
    ['/forgot-password', /Forgot|Reset/i],
  ])('%s still renders its form next to a decorative panel', async (path, heading) => {
    renderApp(path)
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    const panel = screen.getByTestId('auth-panel')
    // Pure decoration: hidden from assistive technology, and the form stays reachable without it.
    expect(panel).toHaveAttribute('aria-hidden', 'true')
    expect(document.querySelector('form input')).not.toBeNull()
  })

  it('the panel scene carries a drawn line and no interactive controls', async () => {
    renderApp('/login')
    await screen.findByRole('heading', { name: 'Welcome back' })
    const panel = screen.getByTestId('auth-panel')
    expect(panel.querySelector('path.auth-line')).not.toBeNull()
    expect(panel.querySelectorAll('a, button, input')).toHaveLength(0)
  })
})
