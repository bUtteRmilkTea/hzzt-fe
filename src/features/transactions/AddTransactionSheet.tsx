import { useNavigate, useRouter, useSearch } from '@tanstack/react-router'
import { ArrowLeftRight, TrendingDown, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { useSpace } from '@/app/providers/SpaceProvider'
import { errorMessage } from '@/shared/api/errors'
import { useWallets } from '@/shared/api/wallets'
import { Button } from '@/shared/ui/Button'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { SheetShell } from '@/shared/ui/SheetShell'
import { useToast } from '@/shared/ui/Toast'
import { useCreateTransaction, useCreateTransfer } from './mutations'
import { safeReturnTo } from './returnTo'
import { TransactionForm } from './TransactionForm'
import { TransferForm } from './TransferForm'

type Kind = 'EXPENSE' | 'INCOME' | 'TRANSFER'

/** Route-driven "add" sheet: Expense, Income or Transfer. Amount comes first, on the calculator keypad. */
export function AddTransactionSheet() {
  const { space } = useSpace()
  const search = useSearch({ from: '/_authed/s/$spaceId/transactions/new' })
  const navigate = useNavigate()
  const router = useRouter()
  const toast = useToast()
  const wallets = useWallets(space.id)
  const [kind, setKind] = useState<Kind>(search.type)
  const [formError, setFormError] = useState<string | null>(null)
  const create = useCreateTransaction()
  const transfer = useCreateTransfer()
  const pending = create.isPending || transfer.isPending

  // Back to where the sheet was opened from (a wallet, say), else History. Re-checked here as well
  // as in the route, because this is the one place that navigates on the strength of the URL.
  const returnTo = safeReturnTo(search.returnTo)
  const close = () =>
    returnTo
      ? router.navigate({ href: returnTo })
      : navigate({ to: '/s/$spaceId/history', params: { spaceId: space.id } })
  const walletById = (id: string) => wallets.data?.items.find((w) => w.id === id)

  return (
    <SheetShell
      open
      onOpenChange={(o) => !o && void close()}
      title="Add transaction"
      footer={
        <Button type="submit" form="txn-form" block disabled={pending}>
          {pending
            ? 'Saving…'
            : kind === 'TRANSFER'
              ? 'Transfer'
              : `Add ${kind === 'EXPENSE' ? 'expense' : 'income'}`}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <SegmentedControl
          aria-label="Transaction type"
          value={kind}
          onValueChange={(k) => {
            setKind(k)
            setFormError(null)
          }}
          options={[
            {
              value: 'EXPENSE',
              label: 'Expense',
              icon: <TrendingDown aria-hidden className="size-4" />,
            },
            {
              value: 'INCOME',
              label: 'Income',
              icon: <TrendingUp aria-hidden className="size-4" />,
            },
            {
              value: 'TRANSFER',
              label: 'Transfer',
              icon: <ArrowLeftRight aria-hidden className="size-4" />,
            },
          ]}
        />
        {formError ? (
          <p role="alert" className="text-sm text-negative">
            {formError}
          </p>
        ) : null}

        {wallets.isSuccess && wallets.data.items.length === 0 ? (
          <p className="text-sm text-label-secondary">
            Add a wallet first, then you can record transactions.
          </p>
        ) : kind === 'TRANSFER' ? (
          <TransferForm
            key="transfer"
            formId="txn-form"
            initial={search.from ? { fromWalletId: search.from } : undefined}
            onSubmit={(v, amounts) => {
              setFormError(null)
              transfer.mutate(
                {
                  fromWalletId: v.fromWalletId,
                  toWalletId: v.toWalletId,
                  date: v.date,
                  note: v.note,
                  ...amounts,
                },
                {
                  onSuccess: () => {
                    toast.show('Transfer saved', 'success')
                    void close()
                  },
                  onError: (err) => setFormError(errorMessage(err)),
                },
              )
            }}
          />
        ) : (
          <TransactionForm
            key={kind}
            type={kind}
            formId="txn-form"
            initial={search.from ? { walletId: search.from } : undefined}
            onSubmit={(v, amount) => {
              setFormError(null)
              const wallet = walletById(v.walletId)
              // The row shows up at once, so leave straight away; a failure rolls it back with a toast.
              create.mutate({
                type: kind,
                walletId: v.walletId,
                walletName: wallet?.name ?? '',
                currency: wallet?.currency ?? space.baseCurrency,
                amount,
                categoryId: v.categoryId,
                date: v.date,
                note: v.note,
              })
              void close()
            }}
          />
        )}
      </div>
    </SheetShell>
  )
}
