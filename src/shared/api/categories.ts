import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import { queryKeys } from './queryKeys'
import type { components } from './schema'

export type CategoryDTO = components['schemas']['categories.CategoryDTO']
export type CategoryType = 'EXPENSE' | 'INCOME'

/**
 * The space's categories of one type, in the user's order. Stats are only requested
 * where they are displayed (the categories screen), never for pickers.
 */
export function useCategories(spaceId: string, type: CategoryType, opts: { stats?: boolean } = {}) {
  const stats = opts.stats ?? false
  return useQuery({
    queryKey: queryKeys.space(spaceId).categories(type, stats),
    queryFn: async () =>
      (
        await api.GET('/spaces/{spaceId}/categories', {
          params: { path: { spaceId }, query: { type, ...(stats ? { includeStats: true } : {}) } },
        })
      ).data ?? [],
  })
}
