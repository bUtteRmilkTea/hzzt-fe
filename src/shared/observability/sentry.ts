import type { ErrorEvent as SentryEvent } from '@sentry/browser'

const SECRET_KEY = /authorization|token|password|cookie|secret|pin/i
const BEARER = /Bearer\s+[A-Za-z0-9._~+/=-]+/g

/** Remove anything that could carry a credential from a value headed for the error tracker. */
export function scrub<T>(value: T, depth = 0): T {
  if (depth > 6 || value === null || value === undefined) return value
  if (typeof value === 'string') return value.replace(BEARER, 'Bearer [redacted]') as T
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1)) as T
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY.test(k) ? '[redacted]' : scrub(v, depth + 1)
    }
    return out as T
  }
  return value
}

/** `beforeSend` hook: scrubs the event, and drops request bodies and cookies entirely. */
export function beforeSend(event: SentryEvent): SentryEvent {
  const scrubbed = scrub(event)
  if (scrubbed.request) {
    delete scrubbed.request.cookies
    delete scrubbed.request.data
  }
  return scrubbed
}

type SentryModule = typeof import('@sentry/browser')
let sentry: SentryModule | null = null

/** Loads the SDK lazily, and only when a DSN is configured. With no DSN nothing is downloaded. */
export async function initObservability(dsn = import.meta.env.VITE_SENTRY_DSN): Promise<boolean> {
  if (!dsn || sentry) return Boolean(sentry)
  try {
    const mod = await import('@sentry/browser')
    mod.init({
      dsn,
      beforeSend,
      tracesSampleRate: 0,
      environment: import.meta.env.MODE,
    })
    sentry = mod
    return true
  } catch {
    return false
  }
}

/** Report an API failure with its request id, so support can trace it server-side. */
export function reportApiError(error: {
  code?: string
  status?: number
  requestId?: string
  message?: string
}): void {
  sentry?.withScope((scope) => {
    scope.setTag('error.code', error.code ?? 'UNKNOWN')
    scope.setTag('http.status', String(error.status ?? 0))
    if (error.requestId) scope.setTag('request.id', error.requestId)
    sentry?.captureMessage(`API error ${error.code ?? 'UNKNOWN'}`, 'error')
  })
}

/** Test hook. */
export function resetObservability(): void {
  sentry = null
}
