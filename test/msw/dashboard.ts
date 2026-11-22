import type { components } from '@/shared/api/schema'
import { PALETTE } from '@/shared/ui/palette'

type S = components['schemas']

export const overview = (
  over: Partial<S['dashboard.OverviewDTO']> = {},
): S['dashboard.OverviewDTO'] => ({
  currency: 'IDR',
  income: '5000000',
  expense: '1250000',
  net: '3750000',
  transactionCount: 14,
  period: { from: '2026-11-01', to: '2026-11-30' },
  change: { incomePct: '10.00', expensePct: '-5.50', netPct: '15.00' },
  warnings: [],
  ...over,
})

export const breakdown = (
  over: Partial<S['dashboard.BreakdownDTO']> = {},
): S['dashboard.BreakdownDTO'] => ({
  currency: 'IDR',
  type: 'EXPENSE',
  total: '1250000',
  items: [
    {
      categoryId: 'e-0',
      name: 'Food',
      icon: '🍜',
      color: PALETTE[5],
      amount: '750000',
      pct: '60.00',
      count: 8,
    },
    {
      categoryId: 'e-1',
      name: 'Transport',
      icon: '🚕',
      color: PALETTE[0],
      amount: '300000',
      pct: '24.00',
      count: 4,
    },
  ],
  uncategorized: { name: 'Uncategorised', amount: '200000', pct: '16.00', count: 2 },
  warnings: [],
  ...over,
})

export const buckets = [
  {
    label: '1–7 Nov',
    fromDate: '2026-11-01',
    toDate: '2026-11-07',
    income: '1000000',
    expense: '400000',
  },
  {
    label: '8–14 Nov',
    fromDate: '2026-11-08',
    toDate: '2026-11-14',
    income: '0',
    expense: '250000',
  },
  {
    label: '15–21 Nov',
    fromDate: '2026-11-15',
    toDate: '2026-11-21',
    income: '4000000',
    expense: '600000',
  },
  { label: '22–28 Nov', fromDate: '2026-11-22', toDate: '2026-11-28', income: '0', expense: '0' },
  { label: '29–30 Nov', fromDate: '2026-11-29', toDate: '2026-11-30', income: '0', expense: '0' },
]

export const analytics = (
  over: Partial<S['dashboard.AnalyticsDTO']> = {},
): S['dashboard.AnalyticsDTO'] => ({
  currency: 'IDR',
  period: { from: '2026-11-01', to: '2026-11-30' },
  buckets,
  warnings: [],
  ...over,
})

/** Every day of a month, as the backend lists them (zeros for quiet days). */
export function calendar(
  month: string,
  overrides: Record<string, Partial<S['dashboard.DayDTO']>> = {},
): S['dashboard.CalendarDTO'] {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const last = new Date(y, m, 0).getDate()
  return {
    currency: 'IDR',
    month,
    warnings: [],
    days: Array.from({ length: last }, (_, i) => {
      const date = `${month}-${String(i + 1).padStart(2, '0')}`
      return { date, count: 0, income: '0', expense: '0', net: '0', ...overrides[date] }
    }),
  }
}
