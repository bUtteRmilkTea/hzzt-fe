import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queryKeys'
import { filtersToApiQuery, type TransactionFilters } from './filters'
import type { PendingTransaction, TxnPage } from './optimistic'

export const HISTORY_PAGE_SIZE = 50

/** The history list: newest first, cursor-paged, for a set of filters. */
export function useTransactions(spaceId: string, filters: TransactionFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.space(spaceId).transactions({ view: 'history', filters }),
    refetchOnWindowFocus: true,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<TxnPage> => {
      const { data } = await api.GET('/spaces/{spaceId}/transactions', {
        params: {
          path: { spaceId },
          query: { ...filtersToApiQuery(filters), limit: HISTORY_PAGE_SIZE, cursor: pageParam },
        },
      })
      return {
        items: (data?.items ?? []) as PendingTransaction[],
        nextCursor: data?.nextCursor || undefined,
      }
    },
    getNextPageParam: (last) => last.nextCursor,
  })
}

/** Per-day in/out totals for the same filters, in the space base currency, for the day headers. */
export function useDailySummary(spaceId: string, filters: TransactionFilters) {
  return useQuery({
    queryKey: queryKeys.space(spaceId).transactions({ view: 'daily', filters }),
    refetchOnWindowFocus: true,
    queryFn: async () =>
      (
        await api.GET('/spaces/{spaceId}/transactions/daily-summary', {
          params: { path: { spaceId }, query: filtersToApiQuery(filters) },
        })
      ).data,
  })
}

export function useTransaction(spaceId: string, id: string) {
  return useQuery({
    queryKey: queryKeys.space(spaceId).transactions({ view: 'one', id }),
    queryFn: async () =>
      (await api.GET('/spaces/{spaceId}/transactions/{id}', { params: { path: { spaceId, id } } }))
        .data,
  })
}
