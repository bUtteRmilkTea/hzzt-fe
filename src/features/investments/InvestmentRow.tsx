import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { useState } from 'react'
import { Amount } from '@/shared/ui/Amount'
import { cn } from '@/shared/ui/cn'
import { PriceSourceBadge } from './priceSource'
import type { InvestmentView, Valuation } from './types'
import { bpsToPct, isSharedIn, parseValuation } from './valuation'

/** "Stale" when the last price is old. Tap or focus to see when it was fetched. */
export function StaleBadge({ valuation }: { valuation: Valuation }) {
  const [open, setOpen] = useState(false)
  if (!valuation.isStale) return null
  const when = valuation.priceAsOf
    ? format(new Date(valuation.priceAsOf), 'd MMM yyyy, HH:mm')
    : 'unknown time'
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        title={`Price as of ${when}`}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-6 items-center rounded-full border border-warning px-2 text-xs font-medium text-warning"
      >
        Stale price
      </button>
      {open ? <span className="text-xs text-label-secondary">Price as of {when}</span> : null}
    </span>
  )
}

export function ShareBadge({ bps }: { bps: number | undefined }) {
  return (
    <span className="inline-flex min-h-6 items-center rounded-full bg-surface-3 px-2 text-xs font-medium text-label-secondary">
      Shared · {bpsToPct(bps)}%
    </span>
  )
}

/** The figures a row shows: converted to the space currency when a rate exists, else in the asset's own. */
export function rowFigures(v: Valuation, quoteCurrency: string) {
  return v.base
    ? {
        currency: v.base.currency,
        value: v.base.marketValue,
        cost: v.base.costBasis,
        pl: v.base.unrealizedPl,
      }
    : { currency: quoteCurrency, value: v.marketValue, cost: v.costBasis, pl: v.unrealizedPl }
}

export function InvestmentRow({
  investment: i,
  spaceId,
}: {
  investment: InvestmentView
  spaceId: string
}) {
  const v = parseValuation(i.valuation)
  const f = v ? rowFigures(v, i.quoteCurrency ?? '') : null
  return (
    <Link
      to="/s/$spaceId/investments/$id"
      params={{ spaceId, id: i.id as string }}
      className="flex flex-col gap-1 border-t border-border py-3 first:border-t-0"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden className="text-2xl">
          {i.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{i.name}</p>
          <p className="truncate text-sm text-label-secondary">{i.symbol}</p>
        </div>
        {f ? <Amount value={f.value} currency={f.currency} className="font-semibold" /> : null}
      </div>
      {f && v ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-label-secondary">
          <span>
            Cost <Amount value={f.cost} currency={f.currency} />
          </span>
          <span className={cn('tabular')}>
            <Amount value={f.pl} currency={f.currency} tone="auto" signDisplay="always" />
            {v.unrealizedPlPct !== null ? <> ({v.unrealizedPlPct}%)</> : null}
          </span>
        </div>
      ) : null}
      {(v || isSharedIn(i) || i.isShared) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {v ? <PriceSourceBadge valuation={v} assetType={i.assetType} /> : null}
          {isSharedIn(i) || i.isShared ? <ShareBadge bps={i.myShareBps} /> : null}
        </div>
      )}
    </Link>
  )
}
