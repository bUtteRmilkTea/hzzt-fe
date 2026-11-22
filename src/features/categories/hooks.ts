import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CategoryDTO, CategoryType } from '@/shared/api/categories'
import { api } from '@/shared/api/client'
import { STATIC_STALE_TIME } from '@/shared/api/queryClient'
import { queryKeys } from '@/shared/api/queryKeys'

export { useCategories } from '@/shared/api/categories'

export function useSuggestions(type: CategoryType) {
  return useQuery({
    queryKey: queryKeys.categorySuggestions(type),
    staleTime: STATIC_STALE_TIME,
    queryFn: async () =>
      (await api.GET('/categories/suggestions', { params: { query: { type } } })).data ?? [],
  })
}

/** Any change to categories can change both tabs, the pickers and the stats, so refetch them all. */
export function useInvalidateCategories(spaceId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.space(spaceId).categoriesAll() })
}

/** Optimistic reorder within one type; snaps back if the server refuses. */
export function useReorderCategories(spaceId: string, type: CategoryType) {
  const queryClient = useQueryClient()
  const key = queryKeys.space(spaceId).categories(type, true)
  return useMutation({
    mutationFn: async (ids: string[]) =>
      api.PUT('/spaces/{spaceId}/categories/order', {
        params: { path: { spaceId } },
        body: { type, ids },
      }),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<CategoryDTO[]>(key)
      if (previous) {
        const byId = new Map(previous.map((c) => [c.id, c]))
        queryClient.setQueryData(
          key,
          ids.map((id) => byId.get(id)).filter((c): c is CategoryDTO => Boolean(c)),
        )
      }
      return { previous }
    },
    onError: (_e, _ids, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous)
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.space(spaceId).categoriesAll() }),
  })
}
