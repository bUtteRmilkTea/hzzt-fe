import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useSpace } from '@/app/providers/SpaceProvider'
import { errorMessage, toAppError } from '@/shared/api/errors'
import { Amount } from '@/shared/ui/Amount'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Page } from '@/shared/ui/Page'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Skeleton } from '@/shared/ui/Skeleton'
import { useToast } from '@/shared/ui/Toast'
import { WarningsStrip } from '@/shared/ui/WarningsStrip'
import { useDeleteInvestment, useInvestment, useRefreshPrice } from './hooks'
import { rowFigures, ShareBadge, StaleBadge } from './InvestmentRow'
import { TradeSheet } from './TradeSheet'
import { bpsToPct, isSharedIn, parseValuation } from './valuation'

const REFRESH_COOLDOWN_S = 60

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="flex items-baseline justify-between gap-3 border-t border-border py-2 text-sm first:border-t-0">
      <span className="text-label-secondary">{label}</span>
      <span className="tabular text-right font-medium">{children}</span>
    </p>
  )
}

function isNotFound(e: unknown): boolean {
  const err = toAppError(e)
  return err.status === 404 || err.code === 'INVESTMENT_NOT_FOUND'
}

export function InvestmentDetailScreen() {
  const { space } = useSpace()
  const { id } = useParams({ from: '/_authed/s/$spaceId/investments/$id/' })
  const navigate = useNavigate()
  const toast = useToast()
  const investment = useInvestment(space.id, id)
  const refresh = useRefreshPrice(id)
  const remove = useDeleteInvestment(id)
  const [trade, setTrade] = useState<'BUY' | 'SELL' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  if (investment.isPending)
    return (
      <Page width="form">
        <Skeleton className="h-64" />
      </Page>
    )
  if (investment.isError && isNotFound(investment.error)) {
    return (
      <Page width="form">
        <EmptyState
          title="You no longer have access"
          description="This investment was removed or is no longer shared with you."
          action={
            <Link to="/s/$spaceId/investments" params={{ spaceId: space.id }}>
              <Button>Back to investments</Button>
            </Link>
          }
        />
      </Page>
    )
  }
  if (investment.isError || !investment.data) {
    return (
      <Page width="form">
        <EmptyState
          title="Couldn't load this investment"
          action={<Button onClick={() => void investment.refetch()}>Try again</Button>}
        />
      </Page>
    )
  }

  const i = investment.data
  const v = parseValuation(i.valuation)
  const total = parseValuation(i.totalValuation)
  const sharedIn = isSharedIn(i)
  const quote = i.quoteCurrency ?? ''
  const f = v ? rowFigures(v, quote) : null
  const realized = i.realizedPl

  const doRefresh = () =>
    refresh.mutate(undefined, {
      onSuccess: () => {
        setCooldown(REFRESH_COOLDOWN_S)
        toast.show('Price refreshed', 'success')
      },
      onError: (e) => {
        const err = toAppError(e)
        if (err.status === 429) {
          const wait = Number(err.details.retryAfter)
          setCooldown(Number.isFinite(wait) && wait > 0 ? Math.ceil(wait) : REFRESH_COOLDOWN_S)
        }
        toast.show(errorMessage(e), 'error')
      },
    })

  return (
    <Page width="form" gap={5}>
      <PageHeader title={i.name ?? 'Investment'} />
      <p className="-mt-3 flex flex-wrap items-center gap-2 text-sm text-label-secondary">
        <span aria-hidden>{i.icon}</span> {i.symbol}
        {sharedIn || i.isShared ? <ShareBadge bps={i.myShareBps} /> : null}
        {v ? <StaleBadge valuation={v} /> : null}
      </p>

      {f && v ? (
        <Card className="flex flex-col" data-testid="valuation">
          <p className="text-sm text-label-secondary">{sharedIn ? 'Your share' : 'Value'}</p>
          <p className="pb-2 text-3xl font-semibold">
            <Amount animate value={f.value} currency={f.currency} />
          </p>
          <Line label="Cost basis">
            <Amount value={f.cost} currency={f.currency} />
          </Line>
          <Line label="Unrealised P/L">
            <Amount value={f.pl} currency={f.currency} tone="auto" signDisplay="always" />
            {v.unrealizedPlPct !== null ? <> ({v.unrealizedPlPct}%)</> : null}
          </Line>
          {v.base ? (
            <Line label={`In ${quote}`}>
              <Amount value={v.marketValue} currency={quote} />
            </Line>
          ) : null}
          {v.base ? <Line label="Exchange rate">{v.base.fxRate}</Line> : null}
        </Card>
      ) : null}
      <WarningsStrip warnings={v?.warnings} />

      {sharedIn && total ? (
        <Card className="grid grid-cols-2 gap-3" data-testid="share-compare">
          <div>
            <p className="text-sm text-label-secondary">My share ({bpsToPct(i.myShareBps)}%)</p>
            <Amount
              value={v ? rowFigures(v, quote).value : '0'}
              currency={f?.currency ?? quote}
              className="font-semibold"
            />
          </div>
          <div>
            <p className="text-sm text-label-secondary">Total</p>
            <Amount
              value={rowFigures(total, quote).value}
              currency={rowFigures(total, quote).currency}
              className="font-semibold"
            />
          </div>
        </Card>
      ) : null}

      <Card className="flex flex-col">
        <h2 className="pb-1 text-sm font-semibold text-label-secondary">Position</h2>
        <Line label="Quantity">{i.quantity}</Line>
        <Line label="Average buy price">
          <Amount value={i.avgBuyPrice ?? '0'} currency={quote} />
        </Line>
        {v ? (
          <Line label="Price source">
            {v.priceSource === 'MARKET'
              ? 'Market'
              : v.priceSource === 'MANUAL'
                ? 'Manual price'
                : 'Manual value'}
          </Line>
        ) : null}
        {v ? (
          <Line label="Current price">
            <Amount value={v.price} currency={quote} />
          </Line>
        ) : null}
        {realized?.sells ? (
          <Line
            label={`Realised P/L (${realized.sells} ${realized.sells === 1 ? 'sale' : 'sales'})`}
          >
            <Amount
              value={realized.amount ?? '0'}
              currency={realized.currency ?? quote}
              tone="auto"
              signDisplay="always"
            />
          </Line>
        ) : null}
      </Card>

      {sharedIn ? (
        <p className="text-center text-sm text-label-tertiary">
          This investment is shared with you, so it is read-only.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <Button className="flex-1" onClick={() => setTrade('BUY')}>
              Buy
            </Button>
            <Button className="flex-1" variant="secondary" onClick={() => setTrade('SELL')}>
              Sell
            </Button>
          </div>
          {i.priceMode === 'AUTO' ? (
            <Button
              variant="secondary"
              disabled={refresh.isPending || cooldown > 0}
              onClick={doRefresh}
            >
              {cooldown > 0
                ? `Refresh available in ${cooldown}s`
                : refresh.isPending
                  ? 'Refreshing…'
                  : 'Refresh price'}
            </Button>
          ) : null}
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" asChild>
              <Link to="/s/$spaceId/investments/$id/sharing" params={{ spaceId: space.id, id }}>
                Share
              </Link>
            </Button>
            <Button
              variant="ghost"
              className="flex-1 text-negative"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
          </div>
        </div>
      )}

      {trade ? (
        <TradeSheet
          side={trade}
          investment={i}
          onRefresh={() => void investment.refetch()}
          onClose={() => setTrade(null)}
        />
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this investment?"
        description="It will be removed from your portfolio. Wallet balances are not changed."
        confirmLabel="Delete"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => {
              toast.show('Investment deleted', 'success')
              void navigate({ to: '/s/$spaceId/investments', params: { spaceId: space.id } })
            },
            onError: (e) => {
              setConfirmDelete(false)
              toast.show(errorMessage(e), 'error')
            },
          })
        }
      />
    </Page>
  )
}
