import { HttpResponse, http } from 'msw'
import type { components } from '@/shared/api/schema'

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

/** Signed-out: the boot refresh is rejected. */
export const anonHandlers = [
  http.post(`${BASE}/auth/refresh`, () =>
    HttpResponse.json(errorEnvelope('REFRESH_TOKEN_INVALID'), { status: 401 }),
  ),
]

/** Signed-in: the boot refresh succeeds and /me returns the user. */
export const authedHandlers = [
  http.post(`${BASE}/auth/refresh`, () => HttpResponse.json(authResponse)),
  http.get(`${BASE}/me`, () => HttpResponse.json(testUser)),
  http.post(`${BASE}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
]
