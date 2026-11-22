/** The preset names the backend accepts for `period` (from the filter screen). */
export const PERIOD_PRESETS = [
  { value: 'TODAY', label: 'Today' },
  { value: 'THIS_WEEK', label: 'This week' },
  { value: 'THIS_PERIOD', label: 'This period' },
  { value: 'LAST_7_DAYS', label: 'Last 7 days' },
  { value: 'LAST_30_DAYS', label: 'Last 30 days' },
  { value: 'LAST_60_DAYS', label: 'Last 60 days' },
  { value: 'LAST_90_DAYS', label: 'Last 90 days' },
  { value: 'THIS_YEAR', label: 'This year' },
  { value: 'ALL_TIME', label: 'All time' },
] as const

export type PeriodPreset = (typeof PERIOD_PRESETS)[number]['value']

export type Period =
  | { kind: 'preset'; preset: PeriodPreset }
  | { kind: 'range'; from: string; to: string } // inclusive YYYY-MM-DD

export const DEFAULT_PERIOD: Period = { kind: 'preset', preset: 'THIS_PERIOD' }

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const isPreset = (v: unknown): v is PeriodPreset => PERIOD_PRESETS.some((p) => p.value === v)

/** A real calendar day in `YYYY-MM-DD` (rejects 2026-02-30). Pure arithmetic, no date library. */
export function isValidDay(v: string): boolean {
  if (!ISO_DAY.test(v)) return false
  const [y, m, d] = v.split('-').map(Number) as [number, number, number]
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/** The URL search params for a period (what the routes store). */
export interface PeriodSearch {
  period?: PeriodPreset
  from?: string
  to?: string
}

export function periodToSearch(p: Period): PeriodSearch {
  return p.kind === 'preset' ? { period: p.preset } : { from: p.from, to: p.to }
}

/**
 * Parse untrusted search params into a Period, or null when none was given or it is invalid.
 * A valid custom range wins over a preset, as on the backend; a reversed range is swapped.
 */
export function parsePeriodSearch(search: object): Period | null {
  const { from, to, period } = search as Record<string, unknown>
  if (typeof from === 'string' && typeof to === 'string' && isValidDay(from) && isValidDay(to)) {
    return from <= to ? { kind: 'range', from, to } : { kind: 'range', from: to, to: from }
  }
  if (isPreset(period)) return { kind: 'preset', preset: period }
  return null
}

/** The period in effect: what the URL says, else the default. */
export function periodFromSearch(search: object): Period {
  return parsePeriodSearch(search) ?? DEFAULT_PERIOD
}

/**
 * `validateSearch` for any route that carries a period. Keeps only what was valid, and never
 * writes the default into the URL, so a plain link stays plain.
 */
export function validatePeriodSearch(search: object): PeriodSearch {
  const p = parsePeriodSearch(search)
  return p ? periodToSearch(p) : {}
}

export function periodToApiQuery(p: Period): { period?: PeriodPreset; from?: string; to?: string } {
  return periodToSearch(p)
}

export function periodsEqual(a: Period, b: Period): boolean {
  if (a.kind !== b.kind) return false
  return a.kind === 'preset'
    ? a.preset === (b as typeof a).preset
    : a.from === (b as typeof a).from && a.to === (b as typeof a).to
}
