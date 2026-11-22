import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { invalidateMoney } from '@/shared/api/invalidate'
import { queryKeys } from '@/shared/api/queryKeys'
import type { components } from '@/shared/api/schema'

type S = components['schemas']
export type GoalDTO = S['goals.GoalDTO']

export function useGoals(spaceId: string) {
  return useQuery({
    queryKey: queryKeys.space(spaceId).goals(),
    refetchOnWindowFocus: true,
    queryFn: async () =>
      (await api.GET('/spaces/{spaceId}/goals', { params: { path: { spaceId } } })).data?.items ??
      [],
  })
}

export function useGoal(spaceId: string, id: string) {
  return useQuery({
    queryKey: queryKeys.space(spaceId).goal(id),
    refetchOnWindowFocus: true,
    queryFn: async () =>
      (await api.GET('/spaces/{spaceId}/goals/{id}', { params: { path: { spaceId, id } } })).data,
  })
}

/** Reserving money changes what a wallet has available, so wallets and goals refetch together. */
function useRefresh(spaceId: string) {
  const queryClient = useQueryClient()
  return () => invalidateMoney(queryClient, spaceId)
}

export function useCreateGoal(spaceId: string) {
  const refresh = useRefresh(spaceId)
  return useMutation({
    mutationFn: async (body: S['goals.createRequest']) =>
      (await api.POST('/spaces/{spaceId}/goals', { params: { path: { spaceId } }, body })).data,
    meta: { silent: true },
    onSettled: refresh,
  })
}

export function useUpdateGoal(spaceId: string, id: string) {
  const refresh = useRefresh(spaceId)
  return useMutation({
    mutationFn: async (body: S['goals.updateRequest']) =>
      (await api.PATCH('/spaces/{spaceId}/goals/{id}', { params: { path: { spaceId, id } }, body }))
        .data,
    meta: { silent: true },
    onSettled: refresh,
  })
}

export function useDeleteGoal(spaceId: string, id: string) {
  const refresh = useRefresh(spaceId)
  return useMutation({
    mutationFn: async () =>
      api.DELETE('/spaces/{spaceId}/goals/{id}', { params: { path: { spaceId, id } } }),
    meta: { silent: true },
    onSettled: refresh,
  })
}

/** Replace this goal's reservation on one wallet. Nothing moves; it only earmarks part of the balance. */
export function useSetAllocation(spaceId: string, goalId: string) {
  const refresh = useRefresh(spaceId)
  return useMutation({
    mutationFn: async (v: { walletId: string; amount: string }) =>
      (
        await api.PUT('/spaces/{spaceId}/goals/{id}/allocations/{walletId}', {
          params: { path: { spaceId, id: goalId, walletId: v.walletId } },
          body: { amount: v.amount },
        })
      ).data,
    meta: { silent: true },
    onSettled: refresh,
  })
}
