import { format } from 'date-fns'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { useState } from 'react'
import { useSpace } from '@/app/providers/SpaceProvider'
import { errorMessage, toAppError } from '@/shared/api/errors'
import { toDecimal } from '@/shared/money'
import { Amount } from '@/shared/ui/Amount'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { Skeleton } from '@/shared/ui/Skeleton'
import { useToast } from '@/shared/ui/Toast'
import { type TradeRow, useDeleteTrade, useInvestmentTrades } from './hooks'

/** The text of the confirm: only the server's own figures, never a client recomputation. */
export function deleteSummary(t: TradeRow, quote: string, newest: boolean): string {
  // `newest`: the position now equals the one this trade left, so deleting it restores its own "before".
  const buy = t.action === 'BUY'
  const what = `${buy ? 'buy' : 'sale'} of ${t.quantity ?? ''}`
  const wallet = t.walletName
    ? buy
      ? `${t.amount} ${t.currency} is returned to ${t.walletName}.`
      : `${t.amount} ${t.currency} is taken back from ${t.walletName}.`
    : ''
  // Only the newest trade goes back to its own "before". An older one is replayed by the server,
  // so the end position is not known here and no figure is promised.
  const position =
    newest && t.positionBefore && t.positionAfter
      ? `Your position goes from ${t.positionAfter.quantity} to ${t.positionBefore.quantity}, average price from ${t.positionAfter.avgBuyPrice} to ${t.positionBefore.avgBuyPrice} ${quote}.`
      : 'Your position is recalculated without this trade, and the trades after it are replayed.'
  return `Delete this ${what}? ${position} ${wallet}`.trim()
}

/** True when the trade's own "after" equals the current position (it is the latest one). */
function producedPosition(t: TradeRow, p: { quantity: string; avgBuyPrice: string }): boolean {
  const a = t.positionAfter
  if (!a?.quantity || !a.avgBuyPrice) return false
  return (
    toDecimal(a.quantity).equals(toDecimal(p.quantity)) &&
    toDecimal(a.avgBuyPrice).equals(toDecimal(p.avgBuyPrice))
  )
}

const REASON: Record<string, string> = {
  OWNER_ONLY: 'Only the owner can delete trades.',
  POSITION_CHANGED_SINCE: 'The position was edited after this trade.',
  TRADE_DELETE_BREAKS_LATER_SELL: 'A later sale needs this trade.',
}

function dateOf(iso: string | undefined, pattern: string) {
  return iso ? format(new Date(iso), pattern) : ''
}

/**
 * Every BUY and SELL of an investment, newest first, with a delete that restores the position.
 * The server replays the later trades; this component only shows what the API says.
 */
export function TradeHistory({
  investmentId,
  quote,
  readOnly,
  position,
}: {
  investmentId: string
  quote: string
  readOnly: boolean
  /** The investment's current position, to tell whether a trade is the one that produced it. */
  position: { quantity: string; avgBuyPrice: string }
}) {
  const { space } = useSpace()
  const toast = useToast()
  const trades = useInvestmentTrades(space.id, investmentId)
  const remove = useDeleteTrade()
  const [target, setTarget] = useState<TradeRow | null>(null)
  const [blocked, setBlocked] = useState<{ message: string; tradeId: string | null } | null>(null)

  const pages = trades.data?.pages ?? []
  const rows = pages.flatMap((p) => p.items)
  const opening = pages[0]?.opening ?? null
  const showOpening = opening && toDecimal(opening.quantity ?? '0').greaterThan(0)

  const confirm = () => {
    if (!target?.id) return
    remove.mutate(target.id, {
      onSuccess: () => {
        setTarget(null)
        setBlocked(null)
        toast.show('Trade deleted, position restored', 'success')
      },
      onError: (e) => {
        const err = toAppError(e)
        setTarget(null)
        if (err.status === 404) {
          toast.show('That trade was already removed', 'default')
          void trades.refetch()
          return
        }
        if (err.code === 'TRADE_DELETE_BREAKS_LATER_SELL') {
          const named = err.details.tradeId ?? err.details.blockedByTradeId
          setBlocked({
            message: errorMessage(e),
            tradeId: typeof named === 'string' ? named : (target.blockedByTradeId ?? null),
          })
          return
        }
        toast.show(errorMessage(e), 'error')
        if (err.code === 'POSITION_CHANGED_SINCE') void trades.refetch()
      },
    })
  }

  const showRow = (id: string) => {
    const el = document.getElementById(`trade-${id}`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    el?.focus()
  }

  return (
    <Card className="flex flex-col gap-3" data-testid="trade-history">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-label-secondary">History</h2>
        {rows.length > 0 ? (
          <span className="text-sm text-label-secondary">
            {rows.length}
            {trades.hasNextPage ? '+' : ''} {rows.length === 1 ? 'trade' : 'trades'}
          </span>
        ) : null}
      </div>

      {blocked ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-2 rounded-lg border border-warning px-4 py-3 text-sm"
        >
          <p>{blocked.message}</p>
          {blocked.tradeId ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => showRow(blocked.tradeId as string)}
            >
              Show that sale
            </Button>
          ) : null}
        </div>
      ) : null}

      {trades.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : trades.isError ? (
        <div className="flex flex-col items-start gap-2 text-sm">
          <p className="text-label-secondary">Couldn't load the history.</p>
          <Button size="sm" variant="secondary" onClick={() => void trades.refetch()}>
            Try again
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-label-secondary">No trades yet. Use Buy or Sell.</p>
      ) : (
        <ul aria-label="Trades" className="flex flex-col divide-y divide-border">
          {rows.map((t) => {
            const buy = t.action === 'BUY'
            const Icon = buy ? ArrowDownLeft : ArrowUpRight
            return (
              <li
                key={t.id}
                id={`trade-${t.id}`}
                tabIndex={-1}
                data-testid="trade-row"
                className="flex flex-col gap-1 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-medium">
                    <Icon aria-hidden className="size-4 shrink-0" />
                    {buy ? 'Buy' : 'Sell'} {t.quantity}
                  </span>
                  <span
                    className="tabular text-label-secondary"
                    title={dateOf(t.occurredAt, 'PPpp')}
                  >
                    {dateOf(t.occurredAt, 'd MMM yyyy')}
                  </span>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-label-secondary">
                  <span>
                    at <Amount value={t.unitPrice ?? '0'} currency={quote} />
                    {t.fee && toDecimal(t.fee).greaterThan(0) ? (
                      <>
                        {' '}
                        · fee <Amount value={t.fee} currency={quote} />
                      </>
                    ) : null}
                  </span>
                  {t.walletName ? (
                    <span>
                      {t.walletName} ·{' '}
                      <Amount value={t.amount ?? '0'} currency={t.currency ?? ''} />
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-3">
                  {!buy && t.realizedPl != null ? (
                    <span className="tabular" data-testid="trade-realized">
                      Realised{' '}
                      <Amount
                        value={t.realizedPl}
                        currency={quote}
                        tone="auto"
                        signDisplay="always"
                      />
                    </span>
                  ) : (
                    <span />
                  )}
                  {readOnly ? null : t.canDelete === false ? (
                    <span className="text-xs text-label-tertiary">
                      {REASON[t.blockedReason ?? ''] ?? 'This trade cannot be deleted now.'}
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-negative"
                      aria-label={`Delete ${buy ? 'buy' : 'sale'} of ${t.quantity} on ${dateOf(t.occurredAt, 'd MMM yyyy')}`}
                      onClick={() => setTarget(t)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {trades.hasNextPage ? (
        <Button
          variant="secondary"
          size="sm"
          disabled={trades.isFetchingNextPage}
          onClick={() => void trades.fetchNextPage()}
        >
          {trades.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </Button>
      ) : null}

      {showOpening ? (
        <p
          className="border-t border-border pt-3 text-sm text-label-secondary"
          data-testid="opening"
        >
          Started with {opening?.quantity} at{' '}
          <Amount value={opening?.avgBuyPrice ?? '0'} currency={quote} />
        </p>
      ) : null}

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => {
          if (!o) setTarget(null)
        }}
        title="Delete this trade?"
        description={target ? deleteSummary(target, quote, producedPosition(target, position)) : ''}
        confirmLabel="Delete trade"
        destructive
        pending={remove.isPending}
        onConfirm={confirm}
      />
    </Card>
  )
}
