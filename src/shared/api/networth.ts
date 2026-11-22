import { useQuery } from '@tanstack/react-query'
import { toMoneyString } from '@/shared/money'
import { api } from './client'
import { queryKeys } from './queryKeys'
import type { components } from './schema'

type S = components['schemas']
type Warning = NonNullable<S['currency.Warning']>

export type HistoryRange = '1M' | '3M' | '6M' | '1Y' | 'ALL'

export interface NetWorthSummary {
  asOf: string | undefined
  currency: string
  netWorth: string
  cash: string
  /** Absent in CASH_ONLY mode, where the server returns only cash and net worth. */
  investments: {
    value: string
    cost: string
    unrealizedPl: string
    unrealizedPlPct: string | null
  } | null
  fixedAssets: string | null
  receivables: string | null
  liabilities: string | null
  trackingMode: 'FULL_NET_WORTH' | 'CASH_ONLY'
  warnings: Warning[]
}

/** Net worth and its components, all in the space base currency and all from the server. */
export function useNetWorthSummary(spaceId: string) {
  return useQuery({
    queryKey: queryKeys.space(spaceId).netWorthSummary(),
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<NetWorthSummary> => {
      const d = (
        await api.GET('/spaces/{spaceId}/net-worth/summary', { params: { path: { spaceId } } })
      ).data
      const opt = (v: unknown) => (v === undefined || v === null ? null : toMoneyString(v))
      return {
        asOf: d?.asOf,
        currency: d?.currency ?? '',
        netWorth: toMoneyString(d?.netWorth),
        cash: toMoneyString(d?.cash),
        investments: d?.investments
          ? {
              value: toMoneyString(d.investments.value),
              cost: toMoneyString(d.investments.cost),
              unrealizedPl: toMoneyString(d.investments.unrealizedPl),
              unrealizedPlPct: opt(d.investments.unrealizedPlPct),
            }
          : null,
        fixedAssets: opt(d?.fixedAssets),
        receivables: opt(d?.receivables),
        liabilities: opt(d?.liabilities),
        trackingMode: d?.trackingMode === 'CASH_ONLY' ? 'CASH_ONLY' : 'FULL_NET_WORTH',
        warnings: d?.warnings ?? [],
      }
    },
  })
}

export interface NetWorthHistory {
  currency: string
  changePct: string | null
  points: Array<{ date: string; netWorth: string; live: boolean }>
}

export function useNetWorthHistory(spaceId: string, range: HistoryRange) {
  return useQuery({
    queryKey: queryKeys.space(spaceId).netWorthHistory(range),
    queryFn: async (): Promise<NetWorthHistory> => {
      const d = (
        await api.GET('/spaces/{spaceId}/net-worth/history', {
          params: { path: { spaceId }, query: { range } },
        })
      ).data
      return {
        currency: d?.currency ?? '',
        changePct: d?.changePct ? toMoneyString(d.changePct) : null,
        points: (d?.points ?? []).map((p) => ({
          date: p.date ?? '',
          netWorth: toMoneyString(p.netWorth),
          live: Boolean(p.live),
        })),
      }
    },
  })
}
