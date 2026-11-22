import type { components } from '@/shared/api/schema'
import { PALETTE } from '@/shared/ui/palette'

type S = components['schemas']

export const summary = (
  over: Partial<S['networth.SummaryDTO']> = {},
): S['networth.SummaryDTO'] => ({
  asOf: '2026-11-19T10:00:00Z',
  currency: 'IDR',
  netWorth: '95000000',
  cash: '30000000',
  investments: {
    value: '40000000',
    cost: '35000000',
    unrealizedPl: '5000000',
    unrealizedPlPct: '14.29',
  },
  fixedAssets: '50000000',
  receivables: '5000000',
  liabilities: '30000000',
  trackingMode: 'FULL_NET_WORTH',
  warnings: [],
  ...over,
})

export const debt: S['manualassets.AssetDTO'] = {
  id: 'a-1',
  kind: 'LIABILITY',
  name: 'Car loan',
  icon: '💳',
  currency: 'IDR',
  currentValue: '500',
  counterpartyName: 'Bank ABC',
  dueDate: '2026-12-31',
  history: [],
}
export const house: S['manualassets.AssetDTO'] = {
  id: 'a-2',
  kind: 'FIXED_ASSET',
  name: 'Apartment',
  icon: '🏠',
  currency: 'IDR',
  currentValue: '50000000',
  estimatedAnnualChangePct: '4',
  history: [
    {
      changedAt: '2026-10-01T00:00:00Z',
      previousValue: '48000000',
      newValue: '50000000',
      reason: 'MANUAL',
    },
  ],
}
export const owed: S['manualassets.AssetDTO'] = {
  id: 'a-3',
  kind: 'RECEIVABLE',
  name: 'Loan to Bob',
  icon: '🤝',
  currency: 'IDR',
  currentValue: '5000000',
  counterpartyName: 'Bob',
  history: [],
}

/** A manual-assets list response; the spec types `totals` as an opaque object keyed by kind. */
export const assetList = (
  kind: string,
  items: S['manualassets.AssetDTO'][],
  total: string,
  warnings: S['currency.Warning'][] = [],
): S['manualassets.ListResponse'] => ({
  items,
  totals: { [kind]: { total, currency: 'IDR', breakdown: [], warnings } } as never,
})

export const goal = (over: Partial<S['goals.GoalDTO']> = {}): S['goals.GoalDTO'] => ({
  id: 'g-1',
  name: 'Holiday',
  icon: '🏖️',
  color: PALETTE[0],
  currency: 'IDR',
  targetAmount: '10000000',
  progress: '2500000',
  progressPct: '25.00',
  remaining: '7500000',
  requiredMonthly: '1250000',
  targetDate: '2027-05-01',
  allocations: [],
  warnings: [],
  ...over,
})
