import { differenceInCalendarDays, parseISO, subMonths } from 'date-fns'
import type { HistoryRange } from '@/shared/api/networth'

/** The choices of the portfolio line: label shown, and the range the API takes. */
export const PORTFOLIO_RANGES: ReadonlyArray<{ value: HistoryRange; label: string }> = [
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '12M' },
  { value: 'ALL', label: 'All time' },
]

const MONTHS: Record<HistoryRange, number | null> = {
  '1W': null,
  YTD: null,
  '1M': 1,
  '3M': 3,
  '6M': 6,
  '1Y': 12,
  ALL: null,
}

/** A first point later than this many days after the start of the range counts as "short". */
const TOLERANCE_DAYS = 3

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`

/**
 * Whether the data is shorter than the range the user chose, and how long it really is
 * (first to last point). The series is never cut or padded: the chart shows what exists and the
 * caller adds the note. `today` is a UTC day like the points.
 */
export function coverage(
  points: ReadonlyArray<{ date: string }>,
  range: HistoryRange,
  today: Date,
): { short: boolean; spanLabel: string } {
  const first = points[0]
  const last = points[points.length - 1]
  const days =
    first && last ? differenceInCalendarDays(parseISO(last.date), parseISO(first.date)) : 0
  // Whole months, rounded, so 90 days reads as 3 months and not 2.
  const months = days >= 30 ? Math.round(days / 30.4375) : 0
  const spanLabel =
    months >= 1
      ? plural(months, 'month')
      : days >= 7
        ? plural(Math.floor(days / 7), 'week')
        : plural(Math.max(days, 1), 'day')
  const n = MONTHS[range]
  if (n === null || !first) return { short: false, spanLabel }
  const start = subMonths(today, n)
  return {
    short: differenceInCalendarDays(parseISO(first.date), start) > TOLERANCE_DAYS,
    spanLabel,
  }
}
