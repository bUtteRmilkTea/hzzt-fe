import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSpace } from '@/app/providers/SpaceProvider'
import { api } from '@/shared/api/client'
import { invalidateMoney } from '@/shared/api/invalidate'
import { priceRefetchInterval, STATIC_STALE_TIME } from '@/shared/api/queryClient'
import { queryKeys } from '@/shared/api/queryKeys'
import type { components } from '@/shared/api/schema'
import { toMoneyString } from '@/shared/money'
import type { InvestmentView, TypeMeta } from './types'

type Summary = components['schemas']['investments.Summary']

/** Per-type form metadata. The forms are built from this, so a new backend type needs no frontend change. */
export function useInvestmentTypes() {
  return useQuery({
    queryKey: queryKeys.investmentTypes(),
    staleTime: STATIC_STALE_TIME,
    queryFn: async (): Promise<TypeMeta[]> => (await api.GET('/investment-types')).data ?? [],
  })
}

export interface InvestmentList {
  items: InvestmentView[]
  summary: {
    currency: string
    totalValue: string
    totalCost: string
    unrealizedPl: string
    unrealizedPlPct: string | null
    warnings: NonNullable<Summary['warnings']>
  }
}

/** Own and shared-in investments, valued for the viewer. Totals come from the server. */
export function useInvestments(spaceId: string, enabled = true) {
  return useQuery({
    enabled,
    queryKey: queryKeys.space(spaceId).investments(),
    refetchOnWindowFocus: true,
    refetchInterval: (q) => priceRefetchInterval(q.state.data?.items),
    refetchIntervalInBackground: false,
    queryFn: async (): Promise<InvestmentList> => {
      const { data } = await api.GET('/spaces/{spaceId}/investments', {
        params: { path: { spaceId }, query: { include: 'shared' } },
      })
      const s = data?.summary
      return {
        items: (data?.items ?? []) as InvestmentView[],
        summary: {
          currency: s?.currency ?? '',
          totalValue: toMoneyString(s?.totalValue),
          totalCost: toMoneyString(s?.totalCost),
          unrealizedPl: toMoneyString(s?.unrealizedPl),
          unrealizedPlPct: s?.unrealizedPlPct ? toMoneyString(s.unrealizedPlPct) : null,
          warnings: s?.warnings ?? [],
        },
      }
    },
  })
}

export function useInvestment(spaceId: string, id: string) {
  return useQuery({
    queryKey: queryKeys.space(spaceId).investment(id),
    refetchOnWindowFocus: true,
    refetchInterval: (q) => priceRefetchInterval(q.state.data ? [q.state.data] : undefined),
    refetchIntervalInBackground: false,
    queryFn: async () =>
      (await api.GET('/spaces/{spaceId}/investments/{id}', { params: { path: { spaceId, id } } }))
        .data as InvestmentView | undefined,
  })
}

export type InstrumentKind = 'CRYPTO' | 'STOCK' | 'ETF'

/** Search the market for an instrument to price automatically. Needs at least two characters. */
export function useInstrumentSearch(kind: InstrumentKind, q: string) {
  const term = q.trim()
  return useQuery({
    queryKey: queryKeys.instrumentSearch(kind, term),
    enabled: term.length >= 2,
    staleTime: 60_000,
    retry: false,
    queryFn: async () =>
      kind === 'CRYPTO'
        ? ((await api.GET('/market/crypto/search', { params: { query: { q: term, limit: 8 } } }))
            .data ?? [])
        : ((
            await api.GET('/market/stocks/search', {
              params: { query: { q: term, kind, limit: 8 } },
            })
          ).data ?? []),
  })
}

/** The spec leaves several bodies here as opaque objects; casting to `never` is the one bridge. */
const asBody = (v: unknown): never => v as never

export function useCreateInvestment() {
  const { space } = useSpace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      (
        await api.POST('/spaces/{spaceId}/investments', {
          params: { path: { spaceId: space.id } },
          body: asBody(body),
        })
      ).data,
    meta: { silent: true },
    // A funded create also moves money out of a wallet.
    onSettled: () => invalidateMoney(queryClient, space.id),
  })
}

/** Clears the manual current value so the market price is used again (F34-T01). */
export function useUseLivePrice(id: string) {
  const { space } = useSpace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () =>
      (
        await api.PATCH('/spaces/{spaceId}/investments/{id}', {
          params: { path: { spaceId: space.id, id } },
          // The API accepts null to clear it; the generated type only allows a string.
          body: asBody({ manualCurrentValue: null }),
        })
      ).data,
    meta: { silent: true },
    onSettled: () => invalidateMoney(queryClient, space.id),
  })
}

export function useDeleteInvestment(id: string) {
  const { space } = useSpace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () =>
      api.DELETE('/spaces/{spaceId}/investments/{id}', {
        params: { path: { spaceId: space.id, id } },
      }),
    meta: { silent: true },
    onSettled: () => invalidateMoney(queryClient, space.id),
  })
}

export function useRefreshPrice(id: string) {
  const { space } = useSpace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () =>
      (
        await api.POST('/spaces/{spaceId}/investments/{id}/refresh-price', {
          params: { path: { spaceId: space.id, id } },
        })
      ).data,
    meta: { silent: true },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.space(space.id).investments() }),
  })
}

export interface TradeInput {
  side: 'BUY' | 'SELL'
  investmentId: string
  walletId: string
  quantity: string
  unitPrice: string
  fee: string
}

const ref = (v: Record<string, unknown>) => v as unknown as Record<string, undefined>

/** BUY is wallet -> investment, SELL is investment -> wallet, both through `POST /transfers`. */
export function useTrade() {
  const { space } = useSpace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (t: TradeInput) => {
      const wallet = { type: 'WALLET', walletId: t.walletId }
      const investment = {
        type: 'INVESTMENT',
        investmentId: t.investmentId,
        quantity: t.quantity,
        unitPrice: t.unitPrice,
        ...(t.fee.trim() ? { fee: t.fee.trim() } : {}),
      }
      return (
        await api.POST('/spaces/{spaceId}/transfers', {
          params: { path: { spaceId: space.id } },
          body: {
            from: ref(t.side === 'BUY' ? wallet : investment),
            to: ref(t.side === 'BUY' ? investment : wallet),
            occurredAt: new Date().toISOString(),
          },
        })
      ).data
    },
    meta: { silent: true },
    onSettled: () => invalidateMoney(queryClient, space.id),
  })
}

export function useParticipants(spaceId: string, id: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.space(spaceId).participants(id),
    enabled,
    queryFn: async () =>
      (
        await api.GET('/spaces/{spaceId}/investments/{id}/participants', {
          params: { path: { spaceId, id } },
        })
      ).data?.items ?? [],
  })
}

export function useSetParticipants(id: string) {
  const { space } = useSpace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { participants: Array<Record<string, unknown>> }) =>
      (
        await api.PUT('/spaces/{spaceId}/investments/{id}/participants', {
          params: { path: { spaceId: space.id, id } },
          body: asBody(body),
        })
      ).data,
    meta: { silent: true },
    // Narrow on purpose: a broad `investments()` prefix invalidation refetched every screen under the
    // investments tree while the user was still on the sharing page. Only the list (exact), this
    // investment and its participants can have changed.
    onSuccess: async () => {
      const keys = queryKeys.space(space.id)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.investments(), exact: true }),
        queryClient.invalidateQueries({ queryKey: keys.investment(id), exact: true }),
        queryClient.invalidateQueries({ queryKey: keys.participants(id), exact: true }),
      ])
    },
  })
}

export function useSharedInvitations() {
  return useQuery({
    queryKey: queryKeys.sharedInvitations(),
    queryFn: async () => (await api.GET('/me/shared-investment-invitations')).data ?? [],
  })
}

export function useAnswerInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (v: { participantId: string; accept: { spaceId: string } | null }) =>
      v.accept
        ? api.POST('/me/shared-investment-invitations/{participantId}/accept', {
            params: { path: { participantId: v.participantId } },
            body: v.accept,
          })
        : api.POST('/me/shared-investment-invitations/{participantId}/decline', {
            params: { path: { participantId: v.participantId } },
          }),
    meta: { silent: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.sharedInvitations() }),
  })
}

/** The latest provider rates re-based to `base`: `rates[Q]` is how many Q one unit of base buys. */
export function useFxLatest(base: string, enabled: boolean) {
  return useQuery({
    queryKey: ['fx-latest', base],
    enabled: enabled && base !== '',
    staleTime: 10 * 60_000,
    queryFn: async () =>
      (await api.GET('/fx/latest', { params: { query: { base } } })).data ?? null,
  })
}

export type TradeRow = components['schemas']['investments.TradeDTO']

const TRADES_PAGE = 20

interface TradePage {
  items: TradeRow[]
  next: string | null
  opening: components['schemas']['investments.OpeningPositionDTO'] | null
}

/** The BUY and SELL history of one investment, newest first, 20 per page. */
export function useInvestmentTrades(spaceId: string, id: string, enabled = true) {
  return useInfiniteQuery({
    enabled,
    queryKey: queryKeys.space(spaceId).investmentTrades(id),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: TradePage) => last.next ?? undefined,
    queryFn: async ({ pageParam }): Promise<TradePage> => {
      const { data } = await api.GET('/spaces/{spaceId}/investments/{id}/trades', {
        params: {
          path: { spaceId, id },
          query: { limit: TRADES_PAGE, ...(pageParam ? { cursor: pageParam } : {}) },
        },
      })
      return {
        items: data?.items ?? [],
        next: data?.next ?? null,
        opening: data?.openingPosition ?? null,
      }
    },
  })
}

/**
 * Deleting a trade restores the position (later trades are replayed by the server) and returns
 * or takes back the wallet amount, so every money query refreshes.
 */
export function useDeleteTrade() {
  const { space } = useSpace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (tradeId: string) =>
      api.DELETE('/spaces/{spaceId}/transfers/{id}', {
        params: { path: { spaceId: space.id, id: tradeId } },
      }),
    meta: { silent: true },
    onSettled: () => invalidateMoney(queryClient, space.id),
  })
}
