import { reportApiError } from '@/shared/observability/sentry'
import type { components } from './schema'

type ErrorEnvelope = components['schemas']['httpx.ErrorEnvelope']

/** The normalised error every API failure becomes (plan 5.3). */
export class AppError extends Error {
  readonly code: string
  readonly details: Record<string, unknown>
  readonly requestId: string | undefined
  readonly status: number

  constructor(init: {
    code: string
    message: string
    status: number
    details?: Record<string, unknown>
    requestId?: string
  }) {
    super(init.message)
    this.name = 'AppError'
    this.code = init.code
    this.status = init.status
    this.details = init.details ?? {}
    this.requestId = init.requestId
  }
}

export const NETWORK_ERROR = 'NETWORK_ERROR'
export const OFFLINE_ERROR = 'OFFLINE'
export const UNKNOWN_ERROR = 'UNKNOWN_ERROR'

/**
 * Backend error code -> user-facing sentence (backend plan Appendix B).
 * Never show a raw code. Unmapped codes fall back to the server message, then GENERIC.
 */
export const ERROR_COPY: Record<string, string> = {
  VALIDATION_FAILED: 'Please check the highlighted fields and try again.',
  UNAUTHENTICATED: 'Your session has expired. Please sign in again.',
  FORBIDDEN: "You don't have permission to do that.",
  NOT_FOUND: "We couldn't find what you were looking for.",
  RATE_LIMITED: 'Too many attempts. Please wait a moment and try again.',
  METHOD_NOT_ALLOWED: 'That action is not available.',
  PAYLOAD_TOO_LARGE: 'That is too large to send.',
  DATABASE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again shortly.',
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again.',
  EMAIL_ALREADY_REGISTERED: 'An account with this email already exists. Try signing in instead.',
  INVALID_CREDENTIALS: 'That email and password combination is incorrect.',
  REFRESH_TOKEN_REUSED: 'Your session was ended for security. Please sign in again.',
  REFRESH_TOKEN_INVALID: 'Your session has expired. Please sign in again.',
  RESET_TOKEN_INVALID: 'This password reset link is invalid or has expired. Request a new one.',
  INVALID_CURRENT_PASSWORD: 'Your current password is incorrect.',
  OWNERSHIP_TRANSFER_REQUIRED: 'Transfer ownership of this space before leaving it.',
  LAST_SPACE: 'You need at least one space, so this one cannot be removed.',
  OWNER_CANNOT_LEAVE: 'The owner cannot leave the space. Transfer ownership first.',
  INVITATION_INVALID: 'This invitation is not valid.',
  INVITATION_EXPIRED: 'This invitation has expired. Ask for a new one.',
  ALREADY_A_MEMBER: 'You are already a member of this space.',
  SPACE_MEMBER_LIMIT: 'This space has reached its member limit.',
  APP_LOCK_TEMPORARILY_LOCKED: 'Too many wrong PINs. Try again after the countdown.',
  APP_LOCK_NOT_ENABLED: 'App lock is not turned on.',
  APP_LOCK_ALREADY_ENABLED: 'App lock is already turned on.',
  INVALID_PIN: 'That PIN is incorrect.',
  FX_RATE_UNAVAILABLE: 'An exchange rate is missing for this currency.',
  CATEGORY_NAME_TAKEN: 'You already have a category with this name.',
  BUDGET_NOT_ALLOWED: 'Only expense categories can have a budget.',
  CATEGORY_TYPE_LOCKED: "A category's type cannot change once it has transactions.",
  CATEGORY_TYPE_MISMATCH: "That category doesn't match the transaction type.",
  WALLET_CURRENCY_LOCKED: "A wallet's currency cannot change once it has transactions.",
  WALLET_HAS_BALANCE: 'This wallet still has a balance. Move or clear it before deleting.',
  USE_SPECIFIC_ENDPOINT: 'This kind of entry must be edited from its own screen.',
  TRANSFER_SAME_WALLET: 'Choose two different wallets.',
  TRANSFER_AMOUNT_REQUIRED: 'Enter the amount received for a cross-currency transfer.',
  NOT_SUPPORTED_YET: 'That is not supported yet.',
  AUTO_PRICE_NOT_SUPPORTED: 'Automatic pricing is not available for this investment type.',
  UPSTREAM_PROVIDER_ERROR: 'The price provider is unavailable right now. Please try again.',
  INSTRUMENT_NOT_FOUND: "We couldn't find that instrument.",
  INSTRUMENT_NOT_LINKED: 'Choose an instrument first.',
  PRICE_MODE_NOT_AUTO: 'This investment is not priced automatically.',
  INSUFFICIENT_QUANTITY: "You don't hold enough to sell that quantity.",
  POSITION_CHANGED_SINCE: 'This position changed since you opened it. Refresh and try again.',
  SHARE_TOTAL_INVALID: 'Shares must add up to exactly 100%.',
  PARTICIPANT_LIMIT: 'This investment has reached its participant limit.',
  OWNER_ONLY: 'Only the owner can do that.',
  SHARE_INVITATION_NOT_FOUND: "We couldn't find that invitation.",
  SHARE_INVITATION_ANSWERED: 'This invitation has already been answered.',
  SHARE_OWNER_CANNOT_LEAVE: 'The owner cannot leave a shared investment.',
  SETTLEMENT_EXCEEDS_BALANCE: 'That is more than the outstanding amount.',
  SETTLEMENT_CURRENCY_MISMATCH: 'The currencies do not match.',
  SETTLEMENT_NOT_SUPPORTED: 'Settlement is not supported for this item.',
  MANUAL_ASSET_CURRENCY_LOCKED: "This item's currency cannot change after a settlement.",
  INSUFFICIENT_AVAILABLE_BALANCE: "The wallet doesn't have enough available balance.",
  [NETWORK_ERROR]: "Can't reach the server. Check your connection and try again.",
  [OFFLINE_ERROR]: "You're offline. Reconnect to save changes.",
}

export const GENERIC_ERROR = 'Something went wrong. Please try again.'

/** Turn an error response body (or anything) into an AppError. */
export function normalizeError(
  body: unknown,
  status: number,
  headerRequestId?: string | null,
): AppError {
  const env = (typeof body === 'object' && body !== null ? body : {}) as ErrorEnvelope
  const code = env.error?.code ?? (status >= 500 ? 'INTERNAL_ERROR' : UNKNOWN_ERROR)
  return new AppError({
    code,
    message: env.error?.message ?? '',
    status,
    details: env.error?.details ?? {},
    requestId: env.requestId ?? headerRequestId ?? undefined,
  })
}

/** Coerce any thrown value into an AppError. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err
  if (err instanceof TypeError) {
    return new AppError({ code: NETWORK_ERROR, message: err.message, status: 0 })
  }
  const message = err instanceof Error ? err.message : ''
  return new AppError({ code: UNKNOWN_ERROR, message, status: 0 })
}

/** User-facing sentence for an error. Never exposes a raw code. */
export function errorMessage(err: unknown): string {
  const e = toAppError(err)
  return ERROR_COPY[e.code] ?? (e.message || GENERIC_ERROR)
}

/**
 * Field-level messages from a VALIDATION_FAILED error: `{ email: 'must be ...' }`.
 * Backend details are a flat field -> message map.
 */
export function fieldErrors(err: unknown): Record<string, string> {
  const e = toAppError(err)
  if (e.code !== 'VALIDATION_FAILED') return {}
  const out: Record<string, string> = {}
  for (const [field, msg] of Object.entries(e.details)) {
    if (typeof msg === 'string') out[field.charAt(0).toLowerCase() + field.slice(1)] = msg
  }
  return out
}

/** Log with the request id so support can trace it. Never log tokens. */
export function logError(err: unknown): void {
  const e = toAppError(err)
  console.error(`[api] ${e.code} (${e.status})`, { requestId: e.requestId })
  reportApiError(e)
}
