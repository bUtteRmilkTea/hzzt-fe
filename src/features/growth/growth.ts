import type { HistoryRange, NetWorthHistory, SeriesKey } from '@/shared/api/networth'

export const SERIES: ReadonlyArray<{ value: SeriesKey; label: string }> = [
  { value: 'netWorth', label: 'Net worth' },
  { value: 'investments', label: 'Investments' },
  { value: 'fixedAssets', label: 'Fixed assets' },
  { value: 'assets', label: 'All assets' },
]

export const GROWTH_RANGES: ReadonlyArray<{ value: HistoryRange; label: string }> = [
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: 'YTD', label: 'YTD' },
  { value: '1Y', label: '1Y' },
  { value: 'ALL', label: 'All' },
]

const PHRASE: Record<HistoryRange, string> = {
  '1W': 'the last week',
  '1M': 'the last month',
  '3M': 'the last 3 months',
  '6M': 'the last 6 months',
  YTD: 'this year so far',
  '1Y': 'the last year',
  ALL: 'all time',
}

export type Direction = 'RISING' | 'FALLING' | 'FLAT'

/** The server's verdict as a sentence. Null direction (no verdict yet) gives no sentence. */
export function directionSentence(direction: Direction | null, range: HistoryRange): string | null {
  if (!direction) return null
  if (direction === 'FLAT') return 'Flat'
  return `${direction === 'RISING' ? 'Rising' : 'Falling'} over ${PHRASE[range]}`
}

export type Trend = 'up' | 'down' | 'flat'

/** Line colour from the server's direction, never from the sign of a client subtraction. */
export function trendFromDirection(direction: Direction | null): Trend | undefined {
  return direction === 'RISING'
    ? 'up'
    : direction === 'FALLING'
      ? 'down'
      : direction === 'FLAT'
        ? 'flat'
        : undefined
}

/** Points of one series, in the shape the line chart takes. */
export function seriesPoints(history: NetWorthHistory | undefined, key: SeriesKey) {
  return (history?.points ?? []).map((p) => ({ date: p.date, value: p[key], live: p.live }))
}
