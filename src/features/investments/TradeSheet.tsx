import { useState } from 'react'
import { useSpace } from '@/app/providers/SpaceProvider'
import { errorMessage, toAppError } from '@/shared/api/errors'
import { useWallets } from '@/shared/api/wallets'
import { Decimal } from '@/shared/money'
import { Amount } from '@/shared/ui/Amount'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { SheetShell } from '@/shared/ui/SheetShell'
import { useToast } from '@/shared/ui/Toast'
import { useTrade } from './hooks'
import { canPreview, exceedsHeld, previewBuy, previewSell, quantityProblem } from './trade'
import type { InvestmentView } from './types'

interface TradeSheetProps {
  side: 'BUY' | 'SELL'
  investment: InvestmentView
  /** Refetch the investment, offered when the position changed under the user. */
  onRefresh: () => void
  onClose: () => void
}

/** Buy (wallet -> investment) or sell (investment -> wallet), with the resulting position previewed first. */
export function TradeSheet({ side, investment, onRefresh, onClose }: TradeSheetProps) {
  const { space } = useSpace()
  const toast = useToast()
  const wallets = useWallets(space.id)
  const trade = useTrade()
  const [walletId, setWalletId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [fee, setFee] = useState('')
  const [error, setError] = useState<{ message: string; stale: boolean } | null>(null)

  const currency = investment.quoteCurrency ?? ''
  const held = investment.quantity ?? '0'
  const list = wallets.data?.items ?? []
  const chosen = walletId || list[0]?.id || ''
  const pos = { quantity: held, avgBuyPrice: investment.avgBuyPrice ?? '0' }
  const qtyProblem = quantityProblem(investment.assetType as string, quantity)
  const previewable = canPreview(quantity, unitPrice, fee) && !qtyProblem
  const tooMuch = side === 'SELL' && exceedsHeld(held, quantity)
  const preview =
    previewable && !tooMuch
      ? side === 'BUY'
        ? previewBuy(pos, quantity, unitPrice, fee)
        : previewSell(pos, quantity, unitPrice, fee)
      : null

  return (
    <SheetShell
      open
      onOpenChange={(o) => !o && onClose()}
      title={`${side === 'BUY' ? 'Buy' : 'Sell'} ${investment.symbol || investment.name}`}
      footer={
        <Button
          block
          disabled={!preview || !chosen || trade.isPending}
          onClick={() => {
            setError(null)
            trade.mutate(
              {
                side,
                investmentId: investment.id as string,
                walletId: chosen,
                quantity,
                unitPrice,
                fee,
              },
              {
                onSuccess: () => {
                  toast.show(side === 'BUY' ? 'Bought' : 'Sold', 'success')
                  onClose()
                },
                onError: (e) => {
                  const code = toAppError(e).code
                  setError({ message: errorMessage(e), stale: code === 'POSITION_CHANGED_SINCE' })
                },
              },
            )
          }}
        >
          {trade.isPending ? 'Saving…' : side === 'BUY' ? 'Buy' : 'Sell'}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        {error ? (
          <div role="alert" className="flex flex-col gap-2 text-sm text-negative">
            <p>{error.message}</p>
            {error.stale ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  onRefresh()
                  setError(null)
                }}
              >
                Refresh position
              </Button>
            ) : null}
          </div>
        ) : null}

        <Field label={side === 'BUY' ? 'Pay from' : 'Receive into'}>
          <Select value={chosen} onChange={(e) => setWalletId(e.target.value)}>
            {list.map((w) => (
              <option key={w.id} value={w.id}>
                {w.icon} {w.name} · {w.currency}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Quantity"
          hint={side === 'SELL' ? `You can sell up to ${new Decimal(held).toFixed()}` : undefined}
          error={tooMuch ? "You don't hold that much to sell." : (qtyProblem ?? undefined)}
        >
          <Input
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </Field>
        <Field label={`Unit price (${currency})`}>
          <Input
            inputMode="decimal"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
          />
        </Field>
        <Field label="Fee (optional)">
          <Input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
        </Field>

        <Card data-testid="trade-preview" className="flex flex-col gap-1 text-sm">
          <p className="font-medium">After this {side === 'BUY' ? 'purchase' : 'sale'}</p>
          {preview ? (
            <>
              <p className="flex justify-between">
                <span className="text-label-secondary">Quantity</span>
                <span className="tabular">{preview.quantity}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-label-secondary">Average price</span>
                <Amount value={preview.avgBuyPrice} currency={currency} />
              </p>
              <p className="flex justify-between">
                <span className="text-label-secondary">{side === 'BUY' ? 'Cost' : 'Proceeds'}</span>
                <Amount value={preview.cash} currency={currency} />
              </p>
              {preview.realizedPl !== null ? (
                <p className="flex justify-between">
                  <span className="text-label-secondary">Realised P/L</span>
                  <Amount
                    value={preview.realizedPl}
                    currency={currency}
                    tone="auto"
                    signDisplay="always"
                  />
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-label-secondary">Enter a quantity and price to preview.</p>
          )}
        </Card>
      </div>
    </SheetShell>
  )
}
