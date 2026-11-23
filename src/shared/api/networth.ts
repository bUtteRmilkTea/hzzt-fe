import { useQuery } from '@tanstack/react-query'
import { toMoneyString } from '@/shared/money'
import { api } from './client'
import { queryKeys } from './queryKeys'
import type { components } from './schema'

type S = components['schemas']
type Warning = NonNullable<S['currency.Warning']>

export type HistoryRange = '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL'

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

/** The verdict of one line over the range, all from the server (BE Phase K). The client decides nothing. */
export interface SeriesVerdict {
  first: string | null
  last: string | null
  change: string | null
  changePct: string | null
  /** Return excluding money put in; null when it cannot be computed. */
  performancePct: string | null
  /** Money put in (or taken out) from outside during the range. */
  netContributions: string | null
  direction: 'RISING' | 'FALLING' | 'FLAT' | null
}

export type SeriesKey = 'netWorth' | 'investments' | 'fixedAssets' | 'assets'

export interface NetWorthHistory {
  currency: string
  changePct: string | null
  /** Change of the portfolio value over the same points; null when it cannot be computed. */
  investmentsChangePct: string | null
  /** Return excluding money put in or taken out (server figure); null when it cannot be computed. */
  performancePct: string | null
  /** Money put in or taken out from outside over the range, base currency (server figure). */
  netContributions: string | null
  /** Per line verdicts; null for a server that does not send them yet. */
  series: Record<SeriesKey, SeriesVerdict> | null
  coverage: { firstPointDate: string | null; requestedFrom: string | null; short: boolean } | null
  /** `investments` is the portfolio value of that day (0 for a day with no holdings). */
  points: Array<{
    date: string
    netWorth: string
    investments: string
    fixedAssets: string
    assets: string
    live: boolean
  }>
}

const orNull = (v: unknown): string | null =>
  v === undefined || v === null || v === '' ? null : toMoneyString(v)

function verdict(d: components['schemas']['networth.SeriesDTO'] | undefined): SeriesVerdict {
  return {
    first: orNull(d?.first),
    last: orNull(d?.last),
    change: orNull(d?.change),
    changePct: orNull(d?.changePct),
    performancePct: orNull(d?.performancePct),
    netContributions: orNull(d?.netContributions),
    direction: d?.direction ?? null,
  }
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
        investmentsChangePct: d?.investmentsChangePct
          ? toMoneyString(d.investmentsChangePct)
          : null,
        performancePct: d?.performancePct ? toMoneyString(d.performancePct) : null,
        netContributions: d?.netContributions ? toMoneyString(d.netContributions) : null,
        series: d?.series
          ? {
              netWorth: verdict(d.series.netWorth),
              investments: verdict(d.series.investments),
              fixedAssets: verdict(d.series.fixedAssets),
              assets: verdict(d.series.assets),
            }
          : null,
        coverage: d?.coverage
          ? {
              firstPointDate: d.coverage.firstPointDate ?? null,
              requestedFrom: d.coverage.requestedFrom ?? null,
              short: Boolean(d.coverage.short),
            }
          : null,
        points: (d?.points ?? []).map((p) => ({
          date: p.date ?? '',
          netWorth: toMoneyString(p.netWorth),
          investments: toMoneyString(p.investments),
          fixedAssets: toMoneyString(p.fixedAssets),
          assets: toMoneyString(p.assets),
          live: Boolean(p.live),
        })),
      }
    },
  })
}
