import createClient, { type Middleware } from 'openapi-fetch'
import { API_BASE_URL } from './env'
import { AppError, normalizeError, toAppError } from './errors'
import type { components, paths } from './schema'

type AuthResponse = components['schemas']['auth.AuthResponse']

// ---- Access token: module-scoped, never in storage, Context or a render tree ----
let accessToken: string | null = null
export const getAccessToken = () => accessToken
export const setAccessToken = (token: string | null) => {
  accessToken = token
}

// ---- Session-expiry notification (the SessionProvider subscribes) ----
type Listener = () => void
const expiredListeners = new Set<Listener>()
export function onSessionExpired(cb: Listener): () => void {
  expiredListeners.add(cb)
  return () => expiredListeners.delete(cb)
}
function notifySessionExpired() {
  accessToken = null
  for (const cb of expiredListeners) cb()
}

// Endpoints that never carry a bearer token and must never trigger a refresh.
const PUBLIC_AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
]
const isPublicAuthPath = (url: string) =>
  PUBLIC_AUTH_PATHS.some((p) => new URL(url).pathname.endsWith(p))

// ---- Single-flight refresh: ten parallel 401s cause exactly one POST /auth/refresh ----
let refreshInFlight: Promise<AuthResponse | null> | null = null

async function doRefresh(): Promise<AuthResponse | null> {
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
  } catch {
    return null
  }
  if (!res.ok) return null
  const body = (await res.json().catch(() => null)) as AuthResponse | null
  if (!body?.accessToken) return null
  accessToken = body.accessToken
  return body
}

/** Restore a session from the httpOnly refresh cookie. Shared by every caller in flight. */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshInFlight ??= doRefresh().finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

/** Test hook: forget any in-flight refresh and the token. */
export function resetClientState() {
  refreshInFlight = null
  accessToken = null
}

function withBearer(request: Request): Request {
  if (!accessToken || isPublicAuthPath(request.url)) return request
  const headers = new Headers(request.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)
  return new Request(request, { headers })
}

/**
 * fetch wrapper used by openapi-fetch: attaches the bearer token, and on a 401
 * refreshes once (single-flight) and retries the original request once.
 */
async function apiFetch(input: Request): Promise<Response> {
  const retryCopy = input.clone()
  let res: Response
  try {
    res = await fetch(withBearer(input))
  } catch (err) {
    throw toAppError(err)
  }
  if (res.status !== 401 || isPublicAuthPath(input.url)) return res

  const refreshed = await refreshSession()
  if (!refreshed) {
    notifySessionExpired()
    return res
  }
  try {
    return await fetch(withBearer(retryCopy))
  } catch (err) {
    throw toAppError(err)
  }
}

/** Turns every non-2xx response into a thrown AppError. */
const errorMiddleware: Middleware = {
  async onResponse({ response }) {
    if (response.ok) return undefined
    const body = await response
      .clone()
      .json()
      .catch(() => null)
    throw normalizeError(body, response.status, response.headers.get('X-Request-Id'))
  },
}

export const api = createClient<paths>({
  baseUrl: API_BASE_URL,
  credentials: 'include',
  fetch: apiFetch,
})
api.use(errorMiddleware)

export { AppError }
