import { useNavigate, useParams } from '@tanstack/react-router'
import { useState } from 'react'
import { useSpace } from '@/app/providers/SpaceProvider'
import { errorMessage, toAppError } from '@/shared/api/errors'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { EmptyState } from '@/shared/ui/EmptyState'
import { SheetShell } from '@/shared/ui/SheetShell'
import { Skeleton } from '@/shared/ui/Skeleton'
import { useToast } from '@/shared/ui/Toast'
import { transactionTitle } from '@/shared/ui/TransactionRow'
import { dayOf } from './datetime'
import { useTransaction } from './hooks'
import {
  useDeleteTransaction,
  useDeleteTransfer,
  useUpdateTransaction,
  useUpdateTransfer,
} from './mutations'
import { TransactionForm } from './TransactionForm'
import { TransferForm } from './TransferForm'

/** What kind of editor a transaction gets (matches the backend's USE_SPECIFIC_ENDPOINT rule). */
export type EditKind = 'income-expense' | 'note-only' | 'transfer' | 'read-only'

export function editKindOf(t: {
  type?: string
  investmentAction?: string
  investment?: unknown
  manualAsset?: unknown
}): EditKind {
  if (t.investmentAction || t.investment || t.manualAsset) return 'read-only'
  if (t.type === 'INCOME' || t.type === 'EXPENSE') return 'income-expense'
  if (t.type === 'ADJUSTMENT' || t.type === 'OPENING_BALANCE') return 'note-only'
  if (t.type === 'TRANSFER') return 'transfer'
  return 'read-only'
}

export function EditTransactionSheet() {
  const { space } = useSpace()
  const { id } = useParams({ from: '/_authed/s/$spaceId/transactions/$id' })
  const navigate = useNavigate()
  const toast = useToast()
  const txn = useTransaction(space.id, id)
  const update = useUpdateTransaction(id)
  const remove = useDeleteTransaction(id)
  const updateTransfer = useUpdateTransfer(id)
  const removeTransfer = useDeleteTransfer(id)
  const [confirm, setConfirm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const close = () => navigate({ to: '/s/$spaceId/history', params: { spaceId: space.id } })

  const t = txn.data
  const kind = t ? editKindOf(t) : 'read-only'
  const isTransfer = kind === 'transfer'
  const deleting = remove.isPending || removeTransfer.isPending

  const doDelete = () => {
    const run = isTransfer ? removeTransfer : remove
    run.mutate(undefined, {
      onSuccess: () => {
        setConfirm(false)
        toast.show('Transaction deleted', 'success')
        void close()
      },
      onError: (err) => {
        setConfirm(false)
        toast.show(errorMessage(err), 'error')
      },
    })
  }

  return (
    <SheetShell
      open
      onOpenChange={(o) => !o && void close()}
      title={t ? transactionTitle(t) : 'Transaction'}
      footer={
        t && kind !== 'read-only' ? (
          <div className="flex flex-col gap-2">
            <Button
              type="submit"
              form="edit-form"
              block
              disabled={update.isPending || updateTransfer.isPending}
            >
              Save changes
            </Button>
            {kind !== 'note-only' ? (
              <Button variant="ghost" block onClick={() => setConfirm(true)}>
                Delete
              </Button>
            ) : null}
          </div>
        ) : undefined
      }
    >
      {txn.isPending ? (
        <Skeleton className="h-48" />
      ) : txn.isError || !t ? (
        <EmptyState
          title="Couldn't load this transaction"
          action={<Button onClick={() => void txn.refetch()}>Try again</Button>}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {formError ? (
            <p role="alert" className="text-sm text-negative">
              {formError}
            </p>
          ) : null}

          {kind === 'read-only' ? (
            <p className="rounded-md border border-border bg-surface-1 px-4 py-3 text-sm text-label-secondary">
              This entry is edited from its own screen (investments or assets), not here.
            </p>
          ) : null}

          {kind === 'note-only' ? (
            <p className="text-sm text-label-secondary">
              This is an automatic entry, so only its note can be changed.
            </p>
          ) : null}

          {kind === 'income-expense' || kind === 'note-only' ? (
            <TransactionForm
              type={t.type === 'INCOME' ? 'INCOME' : 'EXPENSE'}
              formId="edit-form"
              noteOnly={kind === 'note-only'}
              initial={{
                amount: t.amount ?? '',
                walletId: t.wallet?.id ?? '',
                categoryId: t.category?.id ?? null,
                date: t.occurredAt ? dayOf(t.occurredAt) : undefined,
                note: t.note ?? '',
              }}
              onSubmit={(v, amount) => {
                setFormError(null)
                const patch =
                  kind === 'note-only'
                    ? { note: v.note.trim() === '' ? null : v.note.trim() }
                    : {
                        amount,
                        walletId: v.walletId,
                        categoryId: v.categoryId,
                        date: v.date,
                        note: v.note.trim() === '' ? null : v.note.trim(),
                      }
                update.mutate(patch, {
                  onSuccess: () => {
                    toast.show('Saved', 'success')
                    void close()
                  },
                  onError: (err) => setFormError(errorMessage(toAppError(err))),
                })
              }}
            />
          ) : null}

          {isTransfer ? (
            <TransferForm
              formId="edit-form"
              initial={{
                fromWalletId: t.wallet?.id ?? '',
                toWalletId: t.toWallet?.id ?? '',
                amount: t.amount ?? '',
                toAmount: t.toAmount ?? '',
                date: t.occurredAt ? dayOf(t.occurredAt) : undefined,
                note: t.note ?? '',
              }}
              onSubmit={(v, amounts) => {
                setFormError(null)
                updateTransfer.mutate(
                  {
                    fromWalletId: v.fromWalletId,
                    toWalletId: v.toWalletId,
                    date: v.date,
                    note: v.note,
                    ...amounts,
                  },
                  {
                    onSuccess: () => {
                      toast.show('Saved', 'success')
                      void close()
                    },
                    onError: (err) => setFormError(errorMessage(err)),
                  },
                )
              }}
            />
          ) : null}
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this transaction?"
        description="The wallet balance is corrected automatically."
        confirmLabel="Delete"
        destructive
        pending={deleting}
        onConfirm={doDelete}
      />
    </SheetShell>
  )
}
