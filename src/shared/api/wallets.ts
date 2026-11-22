import { useQuery } from '@tanstack/react-query'
import { toMoneyString } from '@/shared/money'
import { api } from './client'
import { queryKeys } from './queryKeys'
import type { components } from './schema'

export type WalletDTO = components['schemas']['wallets.WalletDTO']
type Warning = components['schemas']['currency.Warning']

export interface WalletList {
  items: WalletDTO[]
  total: { amount: string; currency: string; warnings: Warning[] }
}

/** Favourites first, then the user's own order. Stable for equal keys. */
export function sortWallets(items: readonly WalletDTO[]): WalletDTO[] {
  return [...items].sort((a, b) => {
    if (Boolean(a.isFavorite) !== Boolean(b.isFavorite)) return a.isFavorite ? -1 : 1
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  })
}

/** Returns a copy of `list` with the item at `from` moved to `to` (clamped). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list]
  const target = Math.max(0, Math.min(next.length - 1, to))
  const [item] = next.splice(from, 1)
  if (item === undefined) return next
  next.splice(target, 0, item)
  return next
}

export function useWallets(spaceId: string) {
  return useQuery({
    queryKey: queryKeys.space(spaceId).wallets(),
    refetchOnWindowFocus: true, // money screen
    queryFn: async (): Promise<WalletList> => {
      const { data } = await api.GET('/spaces/{spaceId}/wallets', { params: { path: { spaceId } } })
      return {
        items: sortWallets(data?.items ?? []),
        total: {
          amount: toMoneyString(data?.total?.total),
          currency: data?.total?.currency ?? '',
          warnings: data?.total?.warnings ?? [],
        },
      }
    },
  })
}
