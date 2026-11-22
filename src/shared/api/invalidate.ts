import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'

/**
 * One ledger write changes wallets, investments, transactions, net worth, the dashboard and goals
 * together, so every money-moving mutation invalidates all five in one call (plan 4.3).
 */
export function invalidateMoney(queryClient: QueryClient, spaceId: string): Promise<unknown> {
  const keys = queryKeys.space(spaceId)
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: keys.wallets() }),
    queryClient.invalidateQueries({ queryKey: keys.investments() }),
    queryClient.invalidateQueries({ queryKey: keys.manualAssetsAll() }),
    queryClient.invalidateQueries({ queryKey: ['space', spaceId, 'transactions'] }),
    queryClient.invalidateQueries({ queryKey: keys.netWorth() }),
    queryClient.invalidateQueries({ queryKey: keys.dashboard() }),
    queryClient.invalidateQueries({ queryKey: keys.goals() }),
  ])
}
