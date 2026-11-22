import { HttpResponse, http } from 'msw'
import type { components } from '@/shared/api/schema'
import { PALETTE } from '@/shared/ui/palette'

// Typed from the generated schema: a contract change breaks these, not production.
type S = components['schemas']

export const BASE = 'http://localhost:8080/api/v1'

export const testUser = {
  id: 'u-1',
  email: 'jane@example.com',
  name: 'Jane',
  timezone: 'Asia/Jakarta',
  lastActiveSpaceId: 's-1',
  createdAt: '2026-01-01T00:00:00Z',
} satisfies S['auth.UserDTO']

export const authResponse = {
  accessToken: 'tok-1',
  expiresIn: 900,
  user: testUser,
} satisfies S['auth.AuthResponse']

export function errorEnvelope(
  code: string,
  message = '',
  details?: Record<string, unknown>,
): S['httpx.ErrorEnvelope'] {
  return { error: { code, message, details }, requestId: 'req-test' }
}

export const ownerSpace = {
  id: 's-1',
  name: 'Home',
  role: 'OWNER',
  baseCurrency: 'IDR',
  trackingMode: 'FULL_NET_WORTH',
  autoFxConversion: true,
  avatarEmoji: '🏠',
  avatarColor: PALETTE[0],
  memberCount: 2,
} satisfies S['spaces.SpaceDTO']

export const sharedSpace = {
  id: 's-2',
  name: 'Family',
  role: 'MEMBER',
  baseCurrency: 'USD',
  trackingMode: 'FULL_NET_WORTH',
  autoFxConversion: true,
  avatarEmoji: '👨‍👩‍👧',
  avatarColor: PALETTE[7],
  memberCount: 3,
} satisfies S['spaces.SpaceDTO']

export const defaultPreferences = {
  hideAmounts: false,
  keyboardType: 'MINI_CALCULATOR',
  appLockEnabled: false,
} satisfies S['users.PreferencesDTO']

export const currencies = [
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', minorUnits: 0 },
  { code: 'USD', name: 'US Dollar', symbol: '$', minorUnits: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', minorUnits: 2 },
] satisfies S['currency.Currency'][]

/** Signed-out: the boot refresh is rejected. */
export const anonHandlers = [
  http.post(`${BASE}/auth/refresh`, () =>
    HttpResponse.json(errorEnvelope('REFRESH_TOKEN_INVALID'), { status: 401 }),
  ),
]

export const emptySummary = {
  currency: 'IDR',
  netWorth: '0',
  cash: '0',
  trackingMode: 'FULL_NET_WORTH',
  warnings: [],
} satisfies S['networth.SummaryDTO']

export const emptyWallets = {
  items: [],
  total: { total: '0' as unknown as number, currency: 'IDR', warnings: [] }, // the API sends a string
} satisfies S['wallets.ListResponse']

/** Signed-in handlers with overrides: who is active, which spaces exist, the preferences. */
export function makeAuthedHandlers(
  opts: {
    lastActiveSpaceId?: string
    spaces?: S['spaces.SpaceDTO'][]
    preferences?: S['users.PreferencesDTO']
  } = {},
) {
  const user = { ...testUser, lastActiveSpaceId: opts.lastActiveSpaceId ?? 's-1' }
  return [
    http.post(`${BASE}/auth/refresh`, () => HttpResponse.json({ ...authResponse, user })),
    http.get(`${BASE}/me`, () => HttpResponse.json(user)),
    http.post(`${BASE}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
    http.get(`${BASE}/spaces`, () => HttpResponse.json(opts.spaces ?? [ownerSpace, sharedSpace])),
    http.post(`${BASE}/spaces/:spaceId/activate`, () => new HttpResponse(null, { status: 204 })),
    http.get(`${BASE}/me/preferences`, () =>
      HttpResponse.json(opts.preferences ?? defaultPreferences),
    ),
    http.get(`${BASE}/currencies`, () => HttpResponse.json(currencies)),
    http.get(`${BASE}/spaces/:spaceId/wallets`, () => HttpResponse.json(emptyWallets)),
    http.get(`${BASE}/spaces/:spaceId/investments/wrappers`, () =>
      HttpResponse.json({ items: [] }),
    ),
    http.get(`${BASE}/spaces/:spaceId/transactions`, () => HttpResponse.json({ items: [] })),
    http.get(`${BASE}/spaces/:spaceId/transactions/daily-summary`, () =>
      HttpResponse.json({ currency: 'IDR', items: [], warnings: [] }),
    ),
    http.get(`${BASE}/spaces/:spaceId/categories`, () => HttpResponse.json([])),
    http.get(`${BASE}/spaces/:spaceId/net-worth/summary`, () => HttpResponse.json(emptySummary)),
    http.get(`${BASE}/spaces/:spaceId/net-worth/history`, () =>
      HttpResponse.json({ currency: 'IDR', points: [], range: '1M' }),
    ),
    http.get(`${BASE}/spaces/:spaceId/manual-assets`, () =>
      HttpResponse.json({ items: [], totals: {} }),
    ),
    http.get(`${BASE}/spaces/:spaceId/goals`, () => HttpResponse.json({ items: [] })),
  ]
}

/** Signed-in: the boot refresh succeeds and /me returns the user. */
export const authedHandlers = [
  http.post(`${BASE}/auth/refresh`, () => HttpResponse.json(authResponse)),
  http.get(`${BASE}/me`, () => HttpResponse.json(testUser)),
  http.post(`${BASE}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${BASE}/spaces`, () => HttpResponse.json([ownerSpace, sharedSpace])),
  http.post(`${BASE}/spaces/:spaceId/activate`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${BASE}/me/preferences`, () => HttpResponse.json(defaultPreferences)),
  http.get(`${BASE}/currencies`, () => HttpResponse.json(currencies)),
  http.get(`${BASE}/spaces/:spaceId/wallets`, () => HttpResponse.json(emptyWallets)),
  http.get(`${BASE}/spaces/:spaceId/transactions`, () => HttpResponse.json({ items: [] })),
  http.get(`${BASE}/spaces/:spaceId/transactions/daily-summary`, () =>
    HttpResponse.json({ currency: 'IDR', items: [], warnings: [] }),
  ),
  http.get(`${BASE}/spaces/:spaceId/categories`, () => HttpResponse.json([])),
  http.get(`${BASE}/spaces/:spaceId/net-worth/summary`, () => HttpResponse.json(emptySummary)),
  http.get(`${BASE}/spaces/:spaceId/net-worth/history`, () =>
    HttpResponse.json({ currency: 'IDR', points: [], range: '1M' }),
  ),
  http.get(`${BASE}/spaces/:spaceId/manual-assets`, () =>
    HttpResponse.json({ items: [], totals: {} }),
  ),
  http.get(`${BASE}/spaces/:spaceId/goals`, () => HttpResponse.json({ items: [] })),
]
