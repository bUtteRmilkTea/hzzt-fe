import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { invalidateMoney } from '@/shared/api/invalidate'
import { queryKeys } from '@/shared/api/queryKeys'
import type { components } from '@/shared/api/schema'
import { toMoneyString } from '@/shared/money'
import type { AssetKind } from './kinds'

type S = components['schemas']
export type AssetDTO = S['manualassets.AssetDTO']
type Warning = NonNullable<S['currency.Warning']>

export {
  type HistoryRange,
  type NetWorthHistory,
  type NetWorthSummary,
  useNetWorthHistory,
  useNetWorthSummary,
} from '@/shared/api/networth'

export interface ManualAssetList {
  items: AssetDTO[]
  total: { amount: string; currency: string; warnings: Warning[] }
}

/** Manual assets of one kind with that kind's converted total (the `totals` map is keyed by kind). */
export function useManualAssets(spaceId: string, kind: AssetKind, enabled = true) {
  return useQuery({
    queryKey: queryKeys.space(spaceId).manualAssets(kind),
    enabled,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<ManualAssetList> => {
      const d = (
        await api.GET('/spaces/{spaceId}/manual-assets', {
          params: { path: { spaceId }, query: { kind } },
        })
      ).data
      const totals = (d?.totals ?? {}) as Record<
        string,
        { total?: unknown; currency?: string; warnings?: Warning[] }
      >
      const t = totals[kind]
      return {
        items: d?.items ?? [],
        total: {
          amount: toMoneyString(t?.total),
          currency: t?.currency ?? '',
          warnings: t?.warnings ?? [],
        },
      }
    },
  })
}

export function useManualAsset(spaceId: string, id: string) {
  return useQuery({
    queryKey: queryKeys.space(spaceId).manualAsset(id),
    refetchOnWindowFocus: true,
    queryFn: async () =>
      (await api.GET('/spaces/{spaceId}/manual-assets/{id}', { params: { path: { spaceId, id } } }))
        .data,
  })
}

/** After any asset change the lists, net worth and (for settlements) wallets all move together. */
function useRefreshAll(spaceId: string) {
  const queryClient = useQueryClient()
  return () => invalidateMoney(queryClient, spaceId)
}

export function useCreateAsset(spaceId: string) {
  const refresh = useRefreshAll(spaceId)
  return useMutation({
    mutationFn: async (body: S['manualassets.createRequest']) =>
      (await api.POST('/spaces/{spaceId}/manual-assets', { params: { path: { spaceId } }, body }))
        .data,
    meta: { silent: true },
    onSettled: refresh,
  })
}

export function useUpdateAsset(spaceId: string, id: string) {
  const refresh = useRefreshAll(spaceId)
  return useMutation({
    // null clears counterpartyName, dueDate, estimatedAnnualChangePct and note (backend contract)
    mutationFn: async (body: Record<string, unknown>) =>
      (
        await api.PATCH('/spaces/{spaceId}/manual-assets/{id}', {
          params: { path: { spaceId, id } },
          body: body as never,
        })
      ).data,
    meta: { silent: true },
    onSettled: refresh,
  })
}

export function useDeleteAsset(spaceId: string, id: string) {
  const refresh = useRefreshAll(spaceId)
  return useMutation({
    mutationFn: async () =>
      api.DELETE('/spaces/{spaceId}/manual-assets/{id}', { params: { path: { spaceId, id } } }),
    meta: { silent: true },
    onSettled: refresh,
  })
}

export function useSettle(spaceId: string, id: string) {
  const refresh = useRefreshAll(spaceId)
  return useMutation({
    mutationFn: async (body: S['manualassets.settleRequest']) =>
      (
        await api.POST('/spaces/{spaceId}/manual-assets/{id}/settlements', {
          params: { path: { spaceId, id } },
          body,
        })
      ).data,
    meta: { silent: true },
    // A settlement is a transfer: wallets, history and net worth all change.
    onSettled: refresh,
  })
}
