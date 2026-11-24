import { format, formatDistanceStrict } from 'date-fns'
import { TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useNow } from '@/shared/hooks/useNow'
import type { InvestmentView, Valuation } from './types'
import { parseValuation } from './valuation'

export const MANUAL_OVERRIDE_CODE = 'MANUAL_VALUE_OVERRIDES_MARKET'

/** What a price source is called in the UI (D-F49). */
export function priceSourceLabel(
  v: Pick<Valuation, 'priceSource' | 'priceAsOf'>,
  now = new Date(),
) {
  if (v.priceSource === 'MARKET') {
    if (!v.priceAsOf) return 'Live price'
    const when = new Date(v.priceAsOf)
    if (Number.isNaN(when.getTime())) return 'Live price'
    const ms = now.getTime() - when.getTime()
    // Under a minute reads as "just now"; the strict formatter would say "0 seconds ago".
    if (ms < 60_000) return 'Live price · just now'
    return `Live price · ${formatDistanceStrict(when, now, { addSuffix: true })}`
  }
  return v.priceSource === 'MANUAL' ? 'Typed price' : 'Manual value'
}

/** The short form for tight rows: "Live price", "Typed price" or "Manual value", plus "price is old". */
export function priceSourceShort(v: Pick<Valuation, 'priceSource' | 'isStale'>): string {
  const base =
    v.priceSource === 'MARKET'
      ? 'Live price'
      : v.priceSource === 'MANUAL'
        ? 'Typed price'
        : 'Manual value'
  return v.isStale ? `${base} · price is old` : base
}

/** "4 min ago", "3 h ago", "2 d ago" for the stale hint. */
export function priceAge(asOf: string | null, now = new Date()): string | null {
  if (!asOf) return null
  const t = new Date(asOf).getTime()
  if (Number.isNaN(t)) return null
  const min = Math.max(0, Math.floor((now.getTime() - t) / 60_000))
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  if (min < 24 * 60) return `${Math.floor(min / 60)} h ago`
  return `${Math.floor(min / (24 * 60))} d ago`
}

/** What the stale hint says: how old the last price is, and that the app keeps trying. */
export const staleHint = (asOf: string | null, now = new Date()): string => {
  const age = priceAge(asOf, now)
  return age ? `Last price ${age}, retrying` : 'Last price time unknown, retrying'
}

export const sourceName = (assetType: string | undefined) =>
  assetType === 'CRYPTO' ? 'CoinMarketCap' : 'Market'

/** True when a manual value is used although a market price could be. */
export const overridesMarket = (v: Valuation | null) =>
  Boolean(v?.warnings.some((w) => w.code === MANUAL_OVERRIDE_CODE))

/** True when a holding is not priced by the market: typed price or manual value. */
export const notLive = (i: InvestmentView) => {
  const v = parseValuation(i.valuation)
  return v !== null && v.priceSource !== 'MARKET'
}

/** "Live price · 2 minutes ago", "Typed price" or "Manual value", with a warning when the price is old. */
export function PriceSourceBadge({
  valuation,
  assetType,
}: {
  valuation: Valuation
  assetType?: string | undefined
}) {
  const live = valuation.priceSource === 'MARKET'
  const [open, setOpen] = useState(false)
  // A light minute timer keeps "2 minutes ago" true between the 15 minute refetches. It is not a
  // live region: a price that changes every 15 minutes must not be read out.
  const now = useNow()
  const when = valuation.priceAsOf
    ? format(new Date(valuation.priceAsOf), 'd MMM yyyy, HH:mm')
    : 'unknown time'
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span
        data-testid="price-source"
        title={live ? `Source: ${sourceName(assetType)}` : undefined}
        className="inline-flex min-h-6 items-center rounded-full bg-surface-3 px-2 text-xs font-medium text-label-secondary"
      >
        {priceSourceLabel(valuation, now)}
      </span>
      {valuation.isStale ? (
        <span className="inline-flex flex-col">
          <button
            type="button"
            aria-expanded={open}
            title={`Price as of ${when}`}
            onClick={(e) => {
              e.preventDefault()
              setOpen((o) => !o)
            }}
            className="inline-flex min-h-6 items-center gap-1 rounded-full border border-warning px-2 text-xs font-medium text-warning"
          >
            <TriangleAlert aria-hidden className="size-3" />
            Price is old
          </button>
          {open ? (
            <span className="text-xs text-label-secondary">
              {staleHint(valuation.priceAsOf, now)} (as of {when})
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  )
}

/** How many holdings are not priced by the market, counted from the list (never summed). */
export function typedPriceCount(items: readonly InvestmentView[]) {
  const priced = items.filter((i) => parseValuation(i.valuation) !== null)
  return { typed: priced.filter(notLive).length, total: priced.length }
}

/** A neutral note under a portfolio value when some holdings use a typed price or manual value. */
export function TypedPriceNote({ items }: { items: readonly InvestmentView[] }) {
  const { typed, total } = typedPriceCount(items)
  if (typed === 0) return null
  return (
    <p data-testid="typed-price-note" className="text-sm text-label-secondary">
      {typed} of {total} {total === 1 ? 'holding uses' : 'holdings use'} a typed price
    </p>
  )
}
