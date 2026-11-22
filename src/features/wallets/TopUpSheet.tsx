import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useSpace } from '@/app/providers/SpaceProvider'
import { api } from '@/shared/api/client'
import { errorMessage } from '@/shared/api/errors'
import { Decimal, parseInput } from '@/shared/money'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { MoneyInput } from '@/shared/ui/MoneyInput'
import { SheetShell } from '@/shared/ui/SheetShell'
import { useToast } from '@/shared/ui/Toast'
import { useInvalidateMoney } from './hooks'

/** Add money to a wallet (`POST /wallets/{id}/top-up`), recorded as income. */
export function TopUpSheet({
  walletId,
  currency,
  onClose,
}: {
  walletId: string
  currency: string
  onClose: () => void
}) {
  const { space } = useSpace()
  const toast = useToast()
  const invalidateMoney = useInvalidateMoney(space.id)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const topUp = useMutation({
    mutationFn: async (body: { amount: string; note?: string }) =>
      (
        await api.POST('/spaces/{spaceId}/wallets/{id}/top-up', {
          params: { path: { spaceId: space.id, id: walletId } },
          body,
        })
      ).data,
    meta: { silent: true },
    onSuccess: async () => {
      await invalidateMoney()
      toast.show('Balance added', 'success')
      onClose()
    },
    onError: (err) => setError(errorMessage(err)),
  })

  const normalised = amount ? parseInput(amount, currency) : null
  const valid = normalised !== null && new Decimal(normalised).greaterThan(0)

  return (
    <SheetShell
      open
      onOpenChange={(o) => !o && onClose()}
      title="Add balance"
      description="Records money added to this wallet as income."
      footer={
        <Button
          block
          disabled={!valid || topUp.isPending}
          onClick={() => {
            setError(null)
            if (normalised)
              topUp.mutate({ amount: normalised, ...(note.trim() ? { note: note.trim() } : {}) })
          }}
        >
          {topUp.isPending ? 'Adding…' : 'Add balance'}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        {error ? (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        ) : null}
        <Field label="Amount">
          <MoneyInput value={amount} onChange={setAmount} currency={currency} />
        </Field>
        <Field label="Note (optional)">
          <Input maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </SheetShell>
  )
}
