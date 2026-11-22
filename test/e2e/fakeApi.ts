import type { Page } from '@playwright/test'

/**
 * A tiny stateful stand-in for the Go API, installed at the browser level so e2e
 * needs no running backend. `signedIn` plays the role of the httpOnly refresh cookie.
 */
export interface FakeApi {
  calls: { refresh: number }
  readonly signedIn: boolean
}

const user = {
  id: 'u-1',
  email: 'jane@example.com',
  name: 'Jane',
  timezone: 'Asia/Jakarta',
  lastActiveSpaceId: 's-1',
}
const auth = { accessToken: 'e2e-access-token', expiresIn: 900, user }
const envelope = (code: string, message = '', details?: Record<string, unknown>) => ({
  error: { code, message, details },
  requestId: 'req-e2e',
})

export async function installFakeApi(page: Page, opts: { signedIn?: boolean } = {}) {
  const state = { signedIn: opts.signedIn ?? false, calls: { refresh: 0 } }

  await page.route('**/api/v1/**', async (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname.replace(/^.*\/api\/v1/, '')
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

    switch (`${req.method()} ${path}`) {
      case 'POST /auth/refresh':
        state.calls.refresh++
        return state.signedIn ? json(200, auth) : json(401, envelope('REFRESH_TOKEN_INVALID'))
      case 'GET /me':
        return state.signedIn ? json(200, user) : json(401, envelope('UNAUTHENTICATED'))
      case 'POST /auth/register':
        state.signedIn = true
        return json(201, auth)
      case 'POST /auth/login': {
        const body = req.postDataJSON() as { password?: string }
        if (body.password !== 'correct horse') return json(401, envelope('INVALID_CREDENTIALS'))
        state.signedIn = true
        return json(200, auth)
      }
      case 'POST /auth/logout':
        state.signedIn = false
        return route.fulfill({ status: 204 })
      case 'POST /auth/forgot-password':
        return json(200, { message: 'ok' })
      default:
        return json(404, envelope('NOT_FOUND', `no fake for ${req.method()} ${path}`))
    }
  })

  return state as FakeApi
}
