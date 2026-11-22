import { HttpResponse, http } from 'msw'
import { authResponse, BASE, errorEnvelope } from '../../../test/msw/api'
import { server } from '../../../test/msw/server'
import { api, getAccessToken, onSessionExpired, refreshSession, setAccessToken } from './client'
import { AppError } from './errors'

describe('api client', () => {
  it('attaches the bearer token to protected calls but not to public auth calls', async () => {
    const seen: Record<string, string | null> = {}
    server.use(
      http.get(`${BASE}/me`, ({ request }) => {
        seen.me = request.headers.get('authorization')
        return HttpResponse.json(authResponse.user)
      }),
      http.post(`${BASE}/auth/login`, ({ request }) => {
        seen.login = request.headers.get('authorization')
        return HttpResponse.json(authResponse)
      }),
    )
    setAccessToken('abc')
    await api.GET('/me')
    await api.POST('/auth/login', { body: { email: 'a@b.co', password: 'x' } })
    expect(seen.me).toBe('Bearer abc')
    expect(seen.login).toBeNull()
  })

  it('throws a normalised AppError for an error envelope', async () => {
    server.use(
      http.post(`${BASE}/auth/login`, () =>
        HttpResponse.json(errorEnvelope('INVALID_CREDENTIALS', 'nope'), { status: 401 }),
      ),
    )
    const err = await api
      .POST('/auth/login', { body: { email: 'a@b.co', password: 'x' } })
      .catch((e) => e)
    expect(err).toBeInstanceOf(AppError)
    expect(err).toMatchObject({ code: 'INVALID_CREDENTIALS', status: 401, requestId: 'req-test' })
  })

  it('ten parallel 401s cause exactly one POST /auth/refresh', async () => {
    let refreshCalls = 0
    server.use(
      http.get(`${BASE}/me`, ({ request }) =>
        request.headers.get('authorization') === 'Bearer fresh'
          ? HttpResponse.json(authResponse.user)
          : HttpResponse.json(errorEnvelope('UNAUTHENTICATED'), { status: 401 }),
      ),
      http.post(`${BASE}/auth/refresh`, async () => {
        refreshCalls++
        await new Promise((r) => setTimeout(r, 30)) // keep it in flight while the others 401
        return HttpResponse.json({ ...authResponse, accessToken: 'fresh' })
      }),
    )
    setAccessToken('expired')
    const results = await Promise.all(Array.from({ length: 10 }, () => api.GET('/me')))
    expect(refreshCalls).toBe(1)
    expect(results.every((r) => r.data?.id === 'u-1')).toBe(true)
    expect(getAccessToken()).toBe('fresh')
  })

  it('retries the original request only once', async () => {
    let meCalls = 0
    server.use(
      http.get(`${BASE}/me`, () => {
        meCalls++
        return HttpResponse.json(errorEnvelope('UNAUTHENTICATED'), { status: 401 })
      }),
      http.post(`${BASE}/auth/refresh`, () => HttpResponse.json(authResponse)),
    )
    setAccessToken('expired')
    await expect(api.GET('/me')).rejects.toMatchObject({ status: 401 })
    expect(meCalls).toBe(2) // original + exactly one retry
  })

  it('clears the session and notifies when the refresh fails', async () => {
    server.use(
      http.get(`${BASE}/me`, () =>
        HttpResponse.json(errorEnvelope('UNAUTHENTICATED'), { status: 401 }),
      ),
      http.post(`${BASE}/auth/refresh`, () =>
        HttpResponse.json(errorEnvelope('REFRESH_TOKEN_INVALID'), { status: 401 }),
      ),
    )
    const expired = vi.fn()
    const off = onSessionExpired(expired)
    setAccessToken('expired')
    await expect(api.GET('/me')).rejects.toBeInstanceOf(AppError)
    expect(expired).toHaveBeenCalledTimes(1)
    expect(getAccessToken()).toBeNull()
    off()
  })

  it('does not try to refresh after a failed login', async () => {
    let refreshCalls = 0
    server.use(
      http.post(`${BASE}/auth/login`, () =>
        HttpResponse.json(errorEnvelope('INVALID_CREDENTIALS'), { status: 401 }),
      ),
      http.post(`${BASE}/auth/refresh`, () => {
        refreshCalls++
        return HttpResponse.json(authResponse)
      }),
    )
    await expect(
      api.POST('/auth/login', { body: { email: 'a@b.co', password: 'x' } }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    expect(refreshCalls).toBe(0)
  })

  it('maps a network failure to a NETWORK_ERROR AppError', async () => {
    server.use(http.get(`${BASE}/me`, () => HttpResponse.error()))
    await expect(api.GET('/me')).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
  })

  it('refreshSession keeps the token out of storage', async () => {
    server.use(http.post(`${BASE}/auth/refresh`, () => HttpResponse.json(authResponse)))
    await refreshSession()
    expect(getAccessToken()).toBe('tok-1')
    expect(JSON.stringify({ ...localStorage })).not.toContain('tok-1')
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('tok-1')
  })
})
