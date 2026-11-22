import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query'
import type { TransactionDTO } from '@/shared/ui/TransactionRow'
import { dayOf, localDate } from './datetime'
import type { TransactionFilters } from './filters'

export type PendingTransaction = TransactionDTO & { pending?: true }
export interface TxnPage {
  items: PendingTransaction[]
  nextCursor: string | undefined
}
type Snapshot = [QueryKey, InfiniteData<TxnPage> | undefined]

/**
 * Whether a new item would show up in a view with these filters. The period is only checked for
 * a custom range; presets all include "now", so today's item matches them.
 */
export function matchesFilters(
  item: PendingTransaction,
  f: TransactionFilters,
  now = new Date(),
): boolean {
  const day = item.occurredAt ? dayOf(item.occurredAt) : localDate(now)
  if (f.period.kind === 'range' && (day < f.period.from || day > f.period.to)) return false
  if (f.period.kind === 'preset' && f.period.preset !== 'ALL_TIME' && day !== localDate(now))
    return false
  if (f.categoryIds.length && !f.categoryIds.includes(item.category?.id ?? '')) return false
  if (f.walletIds.length) {
    const wallets = [item.wallet?.id, item.toWallet?.id]
    if (!f.walletIds.some((id) => wallets.includes(id))) return false
  }
  const q = f.q.trim().toLowerCase()
  if (q) {
    const hay = [item.title, item.note, item.category?.name, item.wallet?.name]
      .join(' ')
      .toLowerCase()
    if (!hay.includes(q)) return false
  }
  return true
}

interface HistoryKeyShape {
  view?: string
  filters?: TransactionFilters
}

/**
 * Put a pending row at the top of every cached history list it belongs to, returning what to
 * restore if the request fails. Lists it does not belong to just refetch once the write settles.
 */
export function insertPending(
  queryClient: QueryClient,
  spaceId: string,
  item: PendingTransaction,
): Snapshot[] {
  const snapshots: Snapshot[] = []
  const entries = queryClient.getQueriesData<InfiniteData<TxnPage>>({
    queryKey: ['space', spaceId, 'transactions'],
  })
  for (const [key, data] of entries) {
    const shape = key[3] as HistoryKeyShape | undefined
    if (shape?.view !== 'history' || !shape.filters || !data?.pages.length) continue
    if (!matchesFilters(item, shape.filters)) continue
    snapshots.push([key, data])
    const [first, ...rest] = data.pages as [TxnPage, ...TxnPage[]]
    queryClient.setQueryData<InfiniteData<TxnPage>>(key, {
      ...data,
      pages: [{ ...first, items: [item, ...first.items] }, ...rest],
    })
  }
  return snapshots
}

export function restoreSnapshots(queryClient: QueryClient, snapshots: Snapshot[]): void {
  for (const [key, data] of snapshots) queryClient.setQueryData(key, data)
}
