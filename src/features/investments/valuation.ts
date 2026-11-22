import { allocatePct } from '@/shared/charts/pct'
import { Decimal, toDecimal, toMoneyString } from '@/shared/money'
import type { InvestmentDTO, InvestmentView, Valuation } from './types'

const str = (v: unknown): string => toMoneyString(v)

/** Read the opaque `valuation` / `totalValuation` object into a typed shape, or null if absent. */
export function parseValuation(raw: unknown): Valuation | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (r.marketValue === undefined) return null
  const base = r.base as Record<string, unknown> | null | undefined
  return {
    price: str(r.price),
    priceSource: (r.priceSource as Valuation['priceSource']) ?? 'MANUAL',
    priceAsOf: typeof r.priceAsOf === 'string' ? r.priceAsOf : null,
    isStale: Boolean(r.isStale),
    marketValue: str(r.marketValue),
    costBasis: str(r.costBasis),
    unrealizedPl: str(r.unrealizedPl),
    unrealizedPlPct:
      r.unrealizedPlPct === null || r.unrealizedPlPct === undefined ? null : str(r.unrealizedPlPct),
    base: base
      ? {
          currency: String(base.currency ?? ''),
          marketValue: str(base.marketValue),
          costBasis: str(base.costBasis),
          unrealizedPl: str(base.unrealizedPl),
          fxRate: str(base.fxRate),
        }
      : null,
    warnings: Array.isArray(r.warnings) ? (r.warnings as Valuation['warnings']) : [],
  }
}

/** A shared-in investment belongs to someone else: it is read-only everywhere. */
export const isSharedIn = (i: Pick<InvestmentDTO, 'ownership'>): boolean =>
  i.ownership === 'SHARED_IN'

/** Basis points (10,000 = 100%) as a percentage string with two decimals: 5000 -> "50.00". */
export function bpsToPct(bps: number | undefined): string {
  const n = Math.round(bps ?? 0)
  const whole = Math.trunc(n / 100)
  const frac = Math.abs(n % 100)
  return `${n < 0 && whole === 0 ? '-' : ''}${whole}.${String(frac).padStart(2, '0')}`
}

export const TYPE_ORDER = ['CRYPTO', 'ID_STOCK', 'US_STOCK', 'GLOBAL_ETF', 'MUTUAL_FUND'] as const

export const UNASSIGNED_KEY = '_unassigned'

export interface WrapperGroup {
  /** Lower-cased, whitespace-normalised wrapper; `_unassigned` when there is none. */
  key: string
  label: string
  items: InvestmentView[]
  /** Base-currency sums. Items without a usable base value are left out (like the server). */
  value: string
  cost: string
  pl: string
  count: number
  /** Share of the category value at 2 decimals; the shares of a category add up to 100.00. */
  pctOfCategory: string
}

export interface InvestmentGroup {
  key: string
  assetType: string
  /** Every item in the category, across wrappers. */
  items: InvestmentView[]
  wrappers: WrapperGroup[]
  value: string
  cost: string
  pl: string
  /** Currency of the sums (base), or null when no item had one. */
  currency: string | null
}

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '')

/** The wrapper (exchange, broker or platform) of an investment: its own field, else its details. */
export function wrapperOf(i: InvestmentView): { key: string; label: string } {
  const details = (i.details ?? {}) as Record<string, unknown>
  const raw =
    clean((i as { wrapper?: unknown }).wrapper) ||
    clean(details.exchangeOrWallet) ||
    clean(details.platform) ||
    clean(details.broker)
  return raw ? { key: raw.toLowerCase(), label: raw } : { key: UNASSIGNED_KEY, label: 'Unassigned' }
}

function baseOf(
  i: InvestmentView,
): { value: Decimal; cost: Decimal; pl: Decimal; currency: string } | null {
  const v = parseValuation(i.valuation)
  if (!v?.base) return null
  return {
    value: toDecimal(v.base.marketValue),
    cost: toDecimal(v.base.costBasis),
    pl: toDecimal(v.base.unrealizedPl),
    currency: v.base.currency,
  }
}

/** Base-currency market value of one investment, or null when it has no usable rate. */
export function baseValueOf(i: InvestmentView): { value: string; currency: string } | null {
  const b = baseOf(i)
  return b ? { value: b.value.toFixed(), currency: b.currency } : null
}

/** Base-currency value, cost and PnL of some investments (Decimal; items without a rate are left out). */
export function sums(items: readonly InvestmentView[]) {
  let value = new Decimal(0)
  let cost = new Decimal(0)
  let pl = new Decimal(0)
  let currency: string | null = null
  for (const i of items) {
    const b = baseOf(i)
    if (!b) continue
    value = value.plus(b.value)
    cost = cost.plus(b.cost)
    pl = pl.plus(b.pl)
    currency = b.currency
  }
  return { value: value.toFixed(), cost: cost.toFixed(), pl: pl.toFixed(), currency }
}

/**
 * Group the list by asset type (stable display order), then by wrapper. Sums use Decimal on the
 * base-currency figures; the server's own grouping rules apply (feedback-be-plan section 1).
 */
export function groupInvestments(items: readonly InvestmentView[]): InvestmentGroup[] {
  const byType = new Map<string, InvestmentView[]>()
  for (const i of items) {
    const key = i.assetType ?? 'OTHER'
    byType.set(key, [...(byType.get(key) ?? []), i])
  }
  const known: string[] = [...TYPE_ORDER]
  return [...byType.entries()]
    .sort(([a], [b]) => {
      const ia = known.indexOf(a)
      const ib = known.indexOf(b)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
    .map(([assetType, group]) => {
      const byWrapper = new Map<string, { label: string; items: InvestmentView[] }>()
      for (const i of group) {
        const w = wrapperOf(i)
        const cur = byWrapper.get(w.key)
        if (cur) cur.items.push(i)
        else byWrapper.set(w.key, { label: w.label, items: [i] })
      }
      const wrappers = [...byWrapper.entries()]
        .map(([key, w]) => ({
          key,
          label: w.label,
          items: w.items,
          count: w.items.length,
          ...sums(w.items),
        }))
        // Biggest first; the unassigned bucket always last.
        .sort((a, b) =>
          a.key === UNASSIGNED_KEY
            ? 1
            : b.key === UNASSIGNED_KEY
              ? -1
              : toDecimal(b.value).comparedTo(a.value),
        )
      const pcts = allocatePct(wrappers.map((w) => w.value))
      const total = sums(group)
      return {
        key: assetType,
        assetType,
        items: group,
        wrappers: wrappers.map((w, idx) => ({
          key: w.key,
          label: w.label,
          items: w.items,
          count: w.count,
          value: w.value,
          cost: w.cost,
          pl: w.pl,
          pctOfCategory: pcts[idx] as string,
        })),
        value: total.value,
        cost: total.cost,
        pl: total.pl,
        currency: total.currency,
      }
    })
}

/** Pie data for the whole portfolio: the biggest holdings, the rest folded into "Other". */
export function topSlices(
  items: readonly InvestmentView[],
  top = 6,
): Array<{ key: string; name: string; amount: string }> {
  const rows = items
    .flatMap((i) => {
      const b = baseValueOf(i)
      return b ? [{ key: i.id as string, name: i.name ?? '', amount: b.value }] : []
    })
    .sort((a, b) => toDecimal(b.amount).comparedTo(a.amount))
  if (rows.length <= top) return rows
  const head = rows.slice(0, top)
  const other = rows.slice(top).reduce((acc, r) => acc.plus(r.amount), new Decimal(0))
  return [...head, { key: '_other', name: 'Other', amount: other.toFixed() }]
}

/**
 * Pie data per asset class: one slice per asset type in display order, valued in the base
 * currency. A type with no base value (no rate) is left out, as `topSlices` does.
 */
export function categorySlices(
  items: readonly InvestmentView[],
  label: (assetType: string) => string,
): Array<{ key: string; name: string; amount: string }> {
  return groupInvestments(items).flatMap((g) =>
    g.currency && toDecimal(g.value).greaterThan(0)
      ? [{ key: g.key, name: label(g.assetType), amount: g.value }]
      : [],
  )
}
