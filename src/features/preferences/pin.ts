export const PIN_MIN = 4
export const PIN_MAX = 6

/** The backend accepts a PIN of 4 to 6 digits. */
export const isValidPin = (pin: string) => /^\d{4,6}$/.test(pin)

/** Seconds the server asked us to wait (from `details.retryAfter`), or null. */
export function retryAfterSeconds(details: Record<string, unknown>): number | null {
  const v = details.retryAfter
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.ceil(v) : null
}

export function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
