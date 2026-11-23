import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { invalidateMoney } from '@/shared/api/invalidate'
import { STATIC_STALE_TIME } from '@/shared/api/queryClient'
import { queryKeys } from '@/shared/api/queryKeys'
import type { WalletDTO, WalletList } from '@/shared/api/wallets'
import { type Period, periodToApiQuery } from '@/shared/period'

export {
  moveItem,
  sortWallets,
  useWallets,
  type WalletDTO,
  type WalletList,
} from '@/shared/api/wallets'

export function useWallet(spaceId: string, id: string) {
  return useQuery({
    queryKey: queryKeys.space(spaceId).wallet(id),
    refetchOnWindowFocus: true,
    queryFn: async () =>
      (await api.GET('/spaces/{spaceId}/wallets/{id}', { params: { path: { spaceId, id } } })).data,
  })
}

const PAGE_SIZE = 30

/** The wallet's transactions for a period, with the backend's cursor pagination. */
export function useWalletTransactions(
  spaceId: string,
  walletId: string,
  period: Period,
  limit = PAGE_SIZE,
  enabled = true,
) {
  return useInfiniteQuery({
    enabled,
    queryKey: queryKeys.space(spaceId).transactions({ walletId, period, limit }),
    refetchOnWindowFocus: true,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data } = await api.GET('/spaces/{spaceId}/transactions', {
        params: {
          path: { spaceId },
          query: { walletIds: [walletId], ...periodToApiQuery(period), limit, cursor: pageParam },
        },
      })
      return { items: data?.items ?? [], nextCursor: data?.nextCursor || undefined }
    },
    getNextPageParam: (last) => last.nextCursor,
  })
}

export function useCardPresets() {
  return useQuery({
    queryKey: queryKeys.walletCardPresets(),
    staleTime: STATIC_STALE_TIME,
    queryFn: async () => (await api.GET('/wallet-card-presets')).data ?? [],
  })
}

export function useCardTemplates() {
  return useQuery({
    queryKey: queryKeys.walletCardTemplates(),
    staleTime: STATIC_STALE_TIME,
    queryFn: async () => (await api.GET('/wallet-card-templates')).data ?? [],
  })
}

/** Optimistic reorder: the list reorders at once, and snaps back if the server refuses. */
export function useReorderWallets(spaceId: string) {
  const queryClient = useQueryClient()
  const key = queryKeys.space(spaceId).wallets()
  return useMutation({
    mutationFn: async (ids: string[]) =>
      api.PUT('/spaces/{spaceId}/wallets/order', { params: { path: { spaceId } }, body: { ids } }),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<WalletList>(key)
      if (previous) {
        const byId = new Map(previous.items.map((w) => [w.id, w]))
        const items = ids.map((id) => byId.get(id)).filter((w): w is WalletDTO => Boolean(w))
        queryClient.setQueryData<WalletList>(key, { ...previous, items })
      }
      return { previous }
    },
    onError: (_e, _ids, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

/** Run after any mutation that changes balances. */
export function useInvalidateMoney(spaceId: string) {
  const queryClient = useQueryClient()
  return () => invalidateMoney(queryClient, spaceId)
}
