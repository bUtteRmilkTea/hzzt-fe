import { type PeriodSearch, validatePeriodSearch } from '@/shared/period'

export const RANGES = ['1M', '3M', '6M', '1Y', 'ALL'] as const
export type Range = (typeof RANGES)[number]

export interface HomeSearch extends PeriodSearch {
  /** Calendar month, `YYYY-MM`. Defaults to the current month. */
  month?: string
  /** Net worth chart range. Defaults to 1M. */
  range?: Range
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

/** Untrusted URL in, clean typed search out. The defaults are never written into the URL. */
export function validateHomeSearch(search: object): HomeSearch {
  const raw = search as Record<string, unknown>
  const out: HomeSearch = validatePeriodSearch(raw)
  if (typeof raw.month === 'string' && MONTH.test(raw.month)) out.month = raw.month
  if ((RANGES as readonly unknown[]).includes(raw.range) && raw.range !== '1M')
    out.range = raw.range as Range
  return out
}

/** `YYYY-MM` for a month offset from `from` (negative goes back), by pure arithmetic. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const idx = y * 12 + (m - 1) + delta
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`
}

export const monthOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
