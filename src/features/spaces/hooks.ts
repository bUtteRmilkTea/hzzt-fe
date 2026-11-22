import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { STATIC_STALE_TIME } from '@/shared/api/queryClient'
import { queryKeys } from '@/shared/api/queryKeys'

/** Supported currencies. A static catalog: cached for five minutes. */
export function useCurrencies() {
  return useQuery({
    queryKey: queryKeys.currencies(),
    queryFn: async () => (await api.GET('/currencies')).data ?? [],
    staleTime: STATIC_STALE_TIME,
  })
}

export function useMembers(spaceId: string) {
  return useQuery({
    queryKey: queryKeys.space(spaceId).members(),
    queryFn: async () =>
      (await api.GET('/spaces/{spaceId}/members', { params: { path: { spaceId } } })).data ?? [],
  })
}

/** Owner-only on the server (403 for members), so callers must gate on role. */
export function useActiveInvitation(spaceId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.space(spaceId).invitation(),
    enabled,
    queryFn: async () =>
      (await api.GET('/spaces/{spaceId}/invitations/active', { params: { path: { spaceId } } }))
        .data?.invitation ?? null,
  })
}

export function useManualRates(spaceId: string) {
  return useQuery({
    queryKey: queryKeys.space(spaceId).manualRates(),
    queryFn: async () =>
      (await api.GET('/spaces/{spaceId}/fx/manual-rates', { params: { path: { spaceId } } }))
        .data ?? [],
  })
}

/** Refetch the space list after anything that changes a space's own fields or membership. */
export function useInvalidateSpaces() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.spaces() })
}

export { useMutation }
