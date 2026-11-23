import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSpace } from '@/app/providers/SpaceProvider'
import { api } from '@/shared/api/client'
import { errorMessage, toAppError } from '@/shared/api/errors'
import { invalidateMoney } from '@/shared/api/invalidate'
import { useToast } from '@/shared/ui/Toast'
import type { TransactionDTO } from '@/shared/ui/TransactionRow'
import { occurredAtFor } from './datetime'
import { insertPending, type PendingTransaction, restoreSnapshots } from './optimistic'

/** The spec types `from` / `to` as opaque objects; these helpers build the documented shapes. */
const walletRef = (walletId: string) =>
  ({ type: 'WALLET', walletId }) as unknown as Record<string, undefined>

export interface NewTransaction {
  type: 'INCOME' | 'EXPENSE'
  walletId: string
  walletName: string
  currency: string
  amount: string
  categoryId: string | null
  categoryName?: string
  date: string
  note: string
}

let pendingSeq = 0

/** Create an income or expense. The row appears at once (marked pending) and rolls back if the server refuses. */
export function useCreateTransaction() {
  const { space } = useSpace()
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async (t: NewTransaction) =>
      (
        await api.POST('/spaces/{spaceId}/transactions', {
          params: { path: { spaceId: space.id } },
          body: {
            type: t.type,
            walletId: t.walletId,
            amount: t.amount,
            occurredAt: occurredAtFor(t.date),
            ...(t.categoryId ? { categoryId: t.categoryId } : {}),
            ...(t.note.trim() ? { note: t.note.trim() } : {}),
          },
        })
      ).data,
    meta: { silent: true },
    onMutate: async (t) => {
      await queryClient.cancelQueries({ queryKey: ['space', space.id, 'transactions'] })
      const pending: PendingTransaction = {
        id: `pending-${++pendingSeq}`,
        pending: true,
        type: t.type,
        direction: t.type === 'INCOME' ? 'IN' : 'OUT',
        amount: t.amount,
        currency: t.currency,
        note: t.note,
        occurredAt: occurredAtFor(t.date),
        wallet: { id: t.walletId, name: t.walletName },
        ...(t.categoryId ? { category: { id: t.categoryId, name: t.categoryName } } : {}),
      }
      return { snapshots: insertPending(queryClient, space.id, pending) }
    },
    // Mutation-level on purpose: the add sheet closes straight away, and a per-call onError
    // would be skipped once it has unmounted. This always runs, so a failure is never silent.
    onError: (err, _t, ctx) => {
      if (ctx) restoreSnapshots(queryClient, ctx.snapshots)
      const e = toAppError(err)
      toast.show(
        e.code === 'CATEGORY_TYPE_MISMATCH'
          ? errorMessage(e)
          : `Couldn't save that transaction. ${errorMessage(e)}`,
        'error',
      )
    },
    onSettled: () => invalidateMoney(queryClient, space.id),
  })
}

export interface TransferInput {
  fromWalletId: string
  toWalletId: string
  amount: string
  toAmount: string | null
  date: string
  note: string
}

export function useCreateTransfer() {
  const { space } = useSpace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (t: TransferInput) =>
      (
        await api.POST('/spaces/{spaceId}/transfers', {
          params: { path: { spaceId: space.id } },
          body: {
            from: walletRef(t.fromWalletId),
            to: walletRef(t.toWalletId),
            amount: t.amount,
            occurredAt: occurredAtFor(t.date),
            ...(t.toAmount ? { toAmount: t.toAmount } : {}),
            ...(t.note.trim() ? { note: t.note.trim() } : {}),
          },
        })
      ).data,
    meta: { silent: true },
    onSettled: () => invalidateMoney(queryClient, space.id),
  })
}

export function useUpdateTransfer(id: string) {
  const { space } = useSpace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (t: TransferInput) =>
      (
        await api.PATCH('/spaces/{spaceId}/transfers/{id}', {
          params: { path: { spaceId: space.id, id } },
          body: {
            from: walletRef(t.fromWalletId),
            to: walletRef(t.toWalletId),
            amount: t.amount,
            occurredAt: occurredAtFor(t.date),
            note: t.note.trim(),
            ...(t.toAmount ? { toAmount: t.toAmount } : {}),
          },
        })
      ).data,
    meta: { silent: true },
    onSettled: () => invalidateMoney(queryClient, space.id),
  })
}

export function useDeleteTransfer(id: string) {
  const { space } = useSpace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () =>
      api.DELETE('/spaces/{spaceId}/transfers/{id}', {
        params: { path: { spaceId: space.id, id } },
      }),
    meta: { silent: true },
    onSettled: () => invalidateMoney(queryClient, space.id),
  })
}

export interface TransactionPatch {
  amount?: string
  walletId?: string
  /** `null` clears the category. */
  categoryId?: string | null
  date?: string
  /** `null` clears the note. */
  note?: string | null
  /** Reclassify an uncategorised income or expense as a balance adjustment (F33-T06). */
  type?: 'ADJUSTMENT'
}

export function useUpdateTransaction(id: string) {
  const { space } = useSpace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (p: TransactionPatch): Promise<TransactionDTO | undefined> => {
      // The backend accepts null to clear categoryId and note; the generated types only allow strings.
      const body = {
        ...(p.amount ? { amount: p.amount } : {}),
        ...(p.walletId ? { walletId: p.walletId } : {}),
        ...(p.categoryId !== undefined ? { categoryId: p.categoryId as string } : {}),
        ...(p.date ? { occurredAt: occurredAtFor(p.date) } : {}),
        ...(p.note !== undefined ? { note: p.note as string } : {}),
        ...(p.type ? { type: p.type } : {}),
      }
      return (
        await api.PATCH('/spaces/{spaceId}/transactions/{id}', {
          params: { path: { spaceId: space.id, id } },
          body,
        })
      ).data
    },
    meta: { silent: true },
    onSettled: () => invalidateMoney(queryClient, space.id),
  })
}

export function useDeleteTransaction(id: string) {
  const { space } = useSpace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () =>
      api.DELETE('/spaces/{spaceId}/transactions/{id}', {
        params: { path: { spaceId: space.id, id } },
      }),
    meta: { silent: true },
    onSettled: () => invalidateMoney(queryClient, space.id),
  })
}
