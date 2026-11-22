import { useMutation, useQueryClient } from '@tanstack/react-query'
import { looseApi } from '@/shared/api/loose'
import { queryKeys } from '@/shared/api/queryKeys'
import type { WalletDTO, WalletList } from '@/shared/api/wallets'

/** Per-user, per-wallet display flags, synced by the backend (feedback-be-plan 4.4). */
export interface DisplayPrefs {
  hideLogo: boolean
  hideName: boolean
  hideType: boolean
}

export const DEFAULT_PREFS: DisplayPrefs = { hideLogo: false, hideName: false, hideType: false }

/** Fields the backend adds to the wallet DTO (not in the generated schema until `sync:api`). */
export type WalletExt = WalletDTO & {
  displayPrefs?: Partial<DisplayPrefs> | null
  baseBalance?: string | null
  pctOfTotal?: string | null
}

export function prefsOf(w: WalletDTO): DisplayPrefs {
  return { ...DEFAULT_PREFS, ...((w as WalletExt).displayPrefs ?? {}) }
}

/** Optimistic PATCH of one wallet's display flags; rolls back and rethrows on error. */
export function useWalletDisplay(spaceId: string, walletId: string) {
  const queryClient = useQueryClient()
  const listKey = queryKeys.space(spaceId).wallets()
  const oneKey = queryKeys.space(spaceId).wallet(walletId)
  const patchCaches = (patch: Partial<DisplayPrefs>) => {
    const merge = (w: WalletDTO): WalletDTO =>
      ({ ...w, displayPrefs: { ...prefsOf(w), ...patch } }) as WalletDTO
    queryClient.setQueryData<WalletList>(listKey, (l) =>
      l ? { ...l, items: l.items.map((w) => (w.id === walletId ? merge(w) : w)) } : l,
    )
    queryClient.setQueryData<WalletDTO>(oneKey, (w) => (w ? merge(w) : w))
  }
  return useMutation({
    mutationFn: async (patch: Partial<DisplayPrefs>) =>
      (
        await looseApi.PATCH<DisplayPrefs>('/spaces/{spaceId}/wallets/{id}/display-prefs', {
          params: { path: { spaceId, id: walletId } },
          body: patch,
        })
      ).data,
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: listKey })
      const previousList = queryClient.getQueryData<WalletList>(listKey)
      const previousOne = queryClient.getQueryData<WalletDTO>(oneKey)
      patchCaches(patch)
      return { previousList, previousOne }
    },
    onError: (_e, _p, ctx) => {
      queryClient.setQueryData(listKey, ctx?.previousList)
      queryClient.setQueryData(oneKey, ctx?.previousOne)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: listKey })
      void queryClient.invalidateQueries({ queryKey: oneKey })
    },
  })
}
