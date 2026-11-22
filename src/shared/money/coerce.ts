/**
 * The API sends money as strings, but the generated types for a few aggregate
 * fields say `number`. Normalise either into the canonical string form without
 * rounding, so the rest of the app only ever handles strings.
 */
export function toMoneyString(value: unknown): string {
  if (typeof value === 'string') return value.trim() === '' ? '0' : value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return '0'
}
