import { useState } from 'react'
import { useSpace } from '@/app/providers/SpaceProvider'
import { errorMessage } from '@/shared/api/errors'
import { useWallets } from '@/shared/api/wallets'
import { parseInput } from '@/shared/money'
import { Amount } from '@/shared/ui/Amount'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { MoneyInput } from '@/shared/ui/MoneyInput'
import { Select } from '@/shared/ui/Select'
import { SheetShell } from '@/shared/ui/SheetShell'
import { useToast } from '@/shared/ui/Toast'
import { type AssetDTO, useSettle } from './hooks'
import { kindMeta } from './kinds'
import { outstandingAfter, settlementProblem } from './settlement'

/**
 * Receive a payment on money owed to you, or pay down a debt. The wallet must use the asset's currency,
 * and the amount is capped at what is outstanding, so neither server error should be reachable from here.
 */
export function SettleSheet({ asset, onClose }: { asset: AssetDTO; onClose: () => void }) {
  const { space } = useSpace()
  const toast = useToast()
  const wallets = useWallets(space.id)
  const settle = useSettle(space.id, asset.id as string)
  const meta = kindMeta(asset.kind)
  const currency = asset.currency ?? ''
  const outstanding = asset.currentValue ?? '0'
  const eligible = (wallets.data?.items ?? []).filter((w) => w.currency === currency)
  const [walletId, setWalletId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const chosen = walletId || eligible[0]?.id || ''
  const normalised = amount ? (parseInput(amount, currency) ?? amount) : ''
  const problem = amount ? settlementProblem(normalised, outstanding) : 'Enter an amount.'

  return (
    <SheetShell
      open
      onOpenChange={(o) => !o && onClose()}
      title={meta.settleLabel}
      description={asset.name ?? undefined}
      footer={
        <Button
          block
          disabled={Boolean(problem) || !chosen || settle.isPending}
          onClick={() => {
            setError(null)
            settle.mutate(
              {
                walletId: chosen,
                amount: normalised,
                ...(note.trim() ? { note: note.trim() } : {}),
              },
              {
                onSuccess: () => {
                  toast.show('Recorded', 'success')
                  onClose()
                },
                onError: (e) => setError(errorMessage(e)),
              },
            )
          }}
        >
          {settle.isPending ? 'Saving…' : meta.settleLabel}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        {error ? (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        ) : null}
        {eligible.length === 0 ? (
          <p className="text-sm text-label-secondary">
            You need a wallet in {currency} to record this. Add one first.
          </p>
        ) : (
          <Field
            label={asset.kind === 'LIABILITY' ? 'Pay from' : 'Receive into'}
            hint={`Only ${currency} wallets can be used.`}
          >
            <Select value={chosen} onChange={(e) => setWalletId(e.target.value)}>
              {eligible.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.icon} {w.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field
          label={`Amount (${currency})`}
          hint={`Outstanding: ${outstanding}`}
          error={amount && problem ? problem : undefined}
        >
          <MoneyInput value={amount} onChange={setAmount} currency={currency} />
        </Field>
        <Field label="Note (optional)">
          <Input maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {amount && !problem ? (
          <p className="text-sm text-label-secondary" data-testid="outstanding-after">
            Outstanding afterwards:{' '}
            <Amount
              value={outstandingAfter(outstanding, normalised)}
              currency={currency}
              className="font-medium text-label"
            />
          </p>
        ) : null}
      </div>
    </SheetShell>
  )
}
