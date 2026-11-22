import { AppError, logError } from '@/shared/api/errors'
import { beforeSend, initObservability, reportApiError, resetObservability, scrub } from './sentry'

const init = vi.fn()
const captureMessage = vi.fn()
const setTag = vi.fn()
vi.mock('@sentry/browser', () => ({
  init: (o: unknown) => init(o),
  captureMessage: (...a: unknown[]) => captureMessage(...a),
  withScope: (fn: (s: { setTag: typeof setTag }) => void) => fn({ setTag }),
}))

beforeEach(() => {
  resetObservability()
  init.mockClear()
  captureMessage.mockClear()
  setTag.mockClear()
})

describe('scrubbing', () => {
  it('redacts anything that could carry a credential, at any depth', () => {
    const out = scrub({
      user: { id: 1, password: 'hunter2', pin: '1234' },
      headers: { Authorization: 'Bearer abc.def.ghi', 'x-ok': 'fine' },
      nested: [{ accessToken: 'tok', refresh_token: 'r', note: 'safe' }],
      message: 'failed with Bearer abc.def.ghi in it',
    })
    expect(out).toEqual({
      user: { id: 1, password: '[redacted]', pin: '[redacted]' },
      headers: { Authorization: '[redacted]', 'x-ok': 'fine' },
      nested: [{ accessToken: '[redacted]', refresh_token: '[redacted]', note: 'safe' }],
      message: 'failed with Bearer [redacted] in it',
    })
  })
  it('leaves non-secrets alone and does not mutate its input', () => {
    const input = { a: 1, b: ['x'], token: 't' }
    const out = scrub(input)
    expect(out.a).toBe(1)
    expect(input.token).toBe('t')
  })
  it('beforeSend drops request cookies and bodies entirely', () => {
    const e = beforeSend({
      type: undefined,
      request: { cookies: { rt: 'secret' }, data: '{"password":"x"}', url: 'https://app/x' },
    } as never)
    expect(e.request).toEqual({ url: 'https://app/x' })
  })
})

describe('initialisation', () => {
  it('does nothing (and downloads nothing) without a DSN', async () => {
    expect(await initObservability('')).toBe(false)
    expect(init).not.toHaveBeenCalled()
  })
  it('initialises lazily with the scrubber when a DSN is set', async () => {
    expect(await initObservability('https://key@o1.ingest.sentry.io/2')).toBe(true)
    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: 'https://key@o1.ingest.sentry.io/2', beforeSend }),
    )
  })
})

describe('reporting', () => {
  it('attaches the request id, code and status to the report', async () => {
    await initObservability('https://key@o1.ingest.sentry.io/2')
    reportApiError({ code: 'INTERNAL_ERROR', status: 500, requestId: 'req-42' })
    expect(setTag).toHaveBeenCalledWith('request.id', 'req-42')
    expect(setTag).toHaveBeenCalledWith('error.code', 'INTERNAL_ERROR')
    expect(setTag).toHaveBeenCalledWith('http.status', '500')
    expect(captureMessage).toHaveBeenCalledWith('API error INTERNAL_ERROR', 'error')
  })
  it('is a no-op while reporting is off', () => {
    reportApiError({ code: 'X', status: 500, requestId: 'r' })
    expect(captureMessage).not.toHaveBeenCalled()
  })
  it('logError reports through the same path, never the token', async () => {
    await initObservability('https://key@o1.ingest.sentry.io/2')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    logError(
      new AppError({ code: 'FORBIDDEN', message: 'Bearer abc', status: 403, requestId: 'req-9' }),
    )
    expect(setTag).toHaveBeenCalledWith('request.id', 'req-9')
    expect(JSON.stringify(captureMessage.mock.calls)).not.toContain('Bearer')
  })
})
