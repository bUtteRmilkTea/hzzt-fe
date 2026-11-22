import type { Page } from '@playwright/test'
import { PALETTE } from '../../src/shared/ui/palette'

/**
 * A tiny stateful stand-in for the Go API, installed at the browser level so e2e
 * needs no running backend. `signedIn` plays the role of the httpOnly refresh cookie.
 */
export interface FakeApi {
  calls: { refresh: number }
  signedIn: boolean
  /** Space ids passed to POST /spaces/{id}/activate, in order. */
  activated: string[]
  preferences: { hideAmounts: boolean; keyboardType: string; appLockEnabled: boolean }
  /** Wrong PINs seen so far by /me/app-lock/verify. */
  wrongPins: number
}

const user = {
  id: 'u-1',
  email: 'jane@example.com',
  name: 'Jane',
  timezone: 'Asia/Jakarta',
  lastActiveSpaceId: 's-1',
}
const spaces = [
  {
    id: 's-1',
    name: 'Home',
    role: 'OWNER',
    baseCurrency: 'IDR',
    trackingMode: 'FULL_NET_WORTH',
    autoFxConversion: true,
    avatarEmoji: '🏠',
    avatarColor: PALETTE[0],
    memberCount: 2,
  },
  {
    id: 's-2',
    name: 'Family',
    role: 'MEMBER',
    baseCurrency: 'USD',
    trackingMode: 'FULL_NET_WORTH',
    autoFxConversion: true,
    avatarEmoji: '👨‍👩‍👧',
    avatarColor: PALETTE[7],
    memberCount: 3,
  },
]
const currencies = [
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', minorUnits: 0 },
  { code: 'USD', name: 'US Dollar', symbol: '$', minorUnits: 2 },
]
const auth = { accessToken: 'e2e-access-token', expiresIn: 900, user }
const envelope = (code: string, message = '', details?: Record<string, unknown>) => ({
  error: { code, message, details },
  requestId: 'req-e2e',
})

export async function installFakeApi(
  page: Page,
  opts: { signedIn?: boolean; appLock?: boolean } = {},
) {
  const state: FakeApi = {
    signedIn: opts.signedIn ?? false,
    calls: { refresh: 0 },
    activated: [],
    preferences: {
      hideAmounts: false,
      keyboardType: 'MINI_CALCULATOR',
      appLockEnabled: opts.appLock ?? false,
    },
    wrongPins: 0,
  }

  await page.route('**/api/v1/**', async (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname.replace(/^.*\/api\/v1/, '')
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

    const activate = /^\/spaces\/([^/]+)\/activate$/.exec(path)
    if (req.method() === 'POST' && activate) {
      state.activated.push(activate[1] as string)
      return route.fulfill({ status: 204 })
    }
    const members = /^\/spaces\/([^/]+)\/members$/.exec(path)
    if (req.method() === 'GET' && members) {
      return json(200, [{ userId: 'u-1', name: 'Jane', email: 'jane@example.com', role: 'OWNER' }])
    }
    if (req.method() === 'GET' && /^\/spaces\/[^/]+\/invitations\/active$/.test(path)) {
      return json(200, {})
    }

    switch (`${req.method()} ${path}`) {
      case 'GET /spaces':
        return json(200, spaces)
      case 'GET /currencies':
        return json(200, currencies)
      case 'GET /me/preferences':
        return json(200, state.preferences)
      case 'PATCH /me/preferences':
        state.preferences = { ...state.preferences, ...(req.postDataJSON() as object) }
        return json(200, state.preferences)
      case 'POST /me/app-lock/verify': {
        const { pin } = req.postDataJSON() as { pin: string }
        if (pin === '1234') return json(200, { valid: true })
        state.wrongPins++
        return state.wrongPins > 5
          ? json(429, envelope('APP_LOCK_TEMPORARILY_LOCKED', '', { retryAfter: 287 }))
          : json(200, { valid: false })
      }
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

  return state
}
