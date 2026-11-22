import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queryKeys'
import type { components } from '@/shared/api/schema'
import { toMoneyString } from '@/shared/money'
import { type Period, periodToApiQuery } from '@/shared/period'

type S = components['schemas']
type Warning = NonNullable<S['currency.Warning']>

export interface Overview {
  currency: string
  income: string
  expense: string
  net: string
  /** Percentage changes against the previous period; null when the previous value was 0. */
  change: { incomePct: string | null; expensePct: string | null; netPct: string | null }
  transactionCount: number
  warnings: Warning[]
}

const pct = (v: unknown): string | null =>
  v === undefined || v === null || v === '' ? null : toMoneyString(v)

export function useOverview(spaceId: string, period: Period) {
  return useQuery({
    queryKey: queryKeys.space(spaceId).dashboardView('overview', period),
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Overview> => {
      const d = (
        await api.GET('/spaces/{spaceId}/dashboard/overview', {
          params: { path: { spaceId }, query: periodToApiQuery(period) },
        })
      ).data
      return {
        currency: d?.currency ?? '',
        income: toMoneyString(d?.income),
        expense: toMoneyString(d?.expense),
        net: toMoneyString(d?.net),
        change: {
          incomePct: pct(d?.change?.incomePct),
          expensePct: pct(d?.change?.expensePct),
          netPct: pct(d?.change?.netPct),
        },
        transactionCount: d?.transactionCount ?? 0,
        warnings: d?.warnings ?? [],
      }
    },
  })
}

export type BreakdownType = 'EXPENSE' | 'INCOME'

export interface BreakdownItem {
  key: string
  categoryId: string | null
  name: string
  icon: string
  color: string | null
  amount: string
  pct: string
  count: number
}

export function useBreakdown(spaceId: string, period: Period, type: BreakdownType) {
  return useQuery({
    queryKey: queryKeys.space(spaceId).dashboardView('breakdown', { period, type }),
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const d = (
        await api.GET('/spaces/{spaceId}/dashboard/category-breakdown', {
          params: { path: { spaceId }, query: { ...periodToApiQuery(period), type } },
        })
      ).data
      const toItem = (
        c: S['dashboard.CategoryShareDTO'],
        key: string,
        fallbackName: string,
      ): BreakdownItem => ({
        key,
        categoryId: c.categoryId ?? null,
        name: c.name ?? fallbackName,
        icon: c.icon ?? '🏷️',
        color: c.color ?? null,
        amount: toMoneyString(c.amount),
        pct: toMoneyString(c.pct),
        count: c.count ?? 0,
      })
      const items = (d?.items ?? []).map((c, i) =>
        toItem(c, c.categoryId ?? `cat-${i}`, 'Category'),
      )
      const unc =
        d?.uncategorized && Number(toMoneyString(d.uncategorized.amount)) > 0
          ? toItem(d.uncategorized, 'uncategorized', 'Uncategorised')
          : null
      return {
        currency: d?.currency ?? '',
        total: toMoneyString(d?.total),
        items: unc ? [...items, { ...unc, categoryId: null }] : items,
        warnings: d?.warnings ?? [],
      }
    },
  })
}

export function useAnalytics(spaceId: string, period: Period) {
  return useQuery({
    queryKey: queryKeys.space(spaceId).dashboardView('analytics', period),
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const d = (
        await api.GET('/spaces/{spaceId}/dashboard/analytics', {
          params: { path: { spaceId }, query: periodToApiQuery(period) },
        })
      ).data
      return {
        currency: d?.currency ?? '',
        // Labels are kept exactly as the backend sends them ("1–7 Nov" ... "29–30 Nov").
        buckets: (d?.buckets ?? []).map((b) => ({
          label: b.label ?? '',
          income: toMoneyString(b.income),
          expense: toMoneyString(b.expense),
        })),
        warnings: d?.warnings ?? [],
      }
    },
  })
}

export function useCalendar(spaceId: string, month: string) {
  return useQuery({
    queryKey: queryKeys.space(spaceId).dashboardView('calendar', month),
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const d = (
        await api.GET('/spaces/{spaceId}/dashboard/calendar', {
          params: { path: { spaceId }, query: { month } },
        })
      ).data
      return {
        currency: d?.currency ?? '',
        days: (d?.days ?? []).map((x) => ({
          date: x.date ?? '',
          net: toMoneyString(x.net),
          income: toMoneyString(x.income),
          expense: toMoneyString(x.expense),
          count: x.count ?? 0,
        })),
        warnings: d?.warnings ?? [],
      }
    },
  })
}
