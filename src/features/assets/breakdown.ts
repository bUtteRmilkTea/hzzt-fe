import { rowFigures } from '@/features/investments/InvestmentRow'
import type { InvestmentView } from '@/features/investments/types'
import {
  groupInvestments,
  parseValuation,
  sums,
  UNASSIGNED_KEY,
  wrapperOf,
} from '@/features/investments/valuation'
import type { WalletDTO } from '@/shared/api/wallets'
import type { PieSlice } from '@/shared/charts'
import { allocatePct } from '@/shared/charts/pct'
import { toDecimal } from '@/shared/money'
import type { BreakdownGroup } from './AssetBreakdownList'

const WALLET_TYPES: Array<{ type: string; title: string }> = [
  { type: 'BANK', title: 'Bank' },
  { type: 'E_WALLET', title: 'E-wallet' },
  { type: 'CASH', title: 'Cash' },
  { type: 'OTHER', title: 'Other' },
]

/** Wallets grouped by type, in their own currency (the total is converted by the server). */
export function cashGroups(wallets: readonly WalletDTO[], spaceId: string): BreakdownGroup[] {
  return WALLET_TYPES.map(({ type, title }) => ({
    key: type,
    title,
    rows: wallets
      .filter((w) => (w.type ?? 'OTHER') === type)
      .map((w) => ({
        key: w.id as string,
        icon: w.icon,
        name: w.name ?? '',
        value: w.balance ?? '0',
        currency: w.currency ?? '',
        link: { to: '/s/$spaceId/wallets/$id', params: { spaceId, id: w.id as string } },
      })),
  }))
}

/** Investments by category, each row with value and unrealised PnL (base currency when a rate exists). */
export function investmentGroups(
  items: readonly InvestmentView[],
  label: (assetType: string) => string,
  spaceId: string,
): BreakdownGroup[] {
  return groupInvestments(items).map((g) => ({
    key: g.key,
    title: label(g.assetType),
    ...(g.currency ? { total: { value: g.value, currency: g.currency } } : {}),
    rows: g.items.map((i) => {
      const v = parseValuation(i.valuation)
      const f = v ? rowFigures(v, i.quoteCurrency ?? '') : null
      return {
        key: i.id as string,
        icon: i.icon,
        name: i.name ?? '',
        sub: i.symbol,
        value: f?.value ?? '0',
        currency: f?.currency ?? i.quoteCurrency ?? '',
        ...(f && v ? { pl: { amount: f.pl, pct: v.unrealizedPlPct } } : {}),
        link: { to: '/s/$spaceId/investments/$id', params: { spaceId, id: i.id as string } },
      }
    }),
  }))
}

const rowOf = (i: InvestmentView, spaceId: string, sub?: string) => {
  const v = parseValuation(i.valuation)
  const f = v ? rowFigures(v, i.quoteCurrency ?? '') : null
  return {
    key: i.id as string,
    icon: i.icon,
    name: i.name ?? '',
    sub: sub ?? i.symbol,
    value: f?.value ?? '0',
    currency: f?.currency ?? i.quoteCurrency ?? '',
    ...(f && v ? { pl: { amount: f.pl, pct: v.unrealizedPlPct } } : {}),
    link: { to: '/s/$spaceId/investments/$id', params: { spaceId, id: i.id as string } },
  } satisfies BreakdownGroup['rows'][number]
}

/**
 * Investments grouped by broker, exchange or platform (D-F18): one group per wrapper across all
 * asset types, biggest first, holdings without a wrapper last under "Other". It uses the same
 * `wrapperOf` rule as the Investments page, so both pages agree on who holds what. (`accountId`
 * is not used yet: there is no account name to show until backend P18 lands.)
 * Each group carries its holdings count and its share of the portfolio, from `allocatePct`.
 */
export function accountGroups(
  items: readonly InvestmentView[],
  label: (assetType: string) => string,
  spaceId: string,
): BreakdownGroup[] {
  const by = new Map<string, { label: string; items: InvestmentView[] }>()
  for (const i of items) {
    const w = wrapperOf(i)
    const cur = by.get(w.key)
    if (cur) cur.items.push(i)
    else by.set(w.key, { label: w.label, items: [i] })
  }
  const groups = [...by.entries()]
    .map(([key, g]) => ({ key, label: g.label, items: g.items, ...sums(g.items) }))
    .sort((a, b) =>
      a.key === UNASSIGNED_KEY
        ? 1
        : b.key === UNASSIGNED_KEY
          ? -1
          : Number(b.value) === Number(a.value)
            ? a.label.localeCompare(b.label)
            : toDecimal(b.value).comparedTo(a.value),
    )
  const pcts = allocatePct(groups.map((g) => g.value))
  return groups.map((g, idx) => ({
    key: g.key,
    title: g.key === UNASSIGNED_KEY ? 'Other' : g.label,
    subtitle: `${g.items.length} ${g.items.length === 1 ? 'holding' : 'holdings'}${
      g.currency ? ` · ${pcts[idx]}%` : ''
    }`,
    ...(g.currency ? { total: { value: g.value, currency: g.currency } } : {}),
    rows: g.items.map((i) => rowOf(i, spaceId, `${i.symbol ?? ''} · ${label(i.assetType ?? '')}`)),
  }))
}

/** Keeps at most `max` rows in each group and records how many were left out. */
export function capEach(groups: readonly BreakdownGroup[], max: number): BreakdownGroup[] {
  return groups.map((g) =>
    g.rows.length > max ? { ...g, rows: g.rows.slice(0, max), more: g.rows.length - max } : g,
  )
}

/**
 * The one pie of the Assets page: how the five groups compare. Every figure is the server's
 * (already in the base currency), so there is no client sum and no FX. Debt is a slice of its own,
 * so the shares are of the gross total, not of net worth. Zero or absent groups are left out.
 */
export function assetMixSlices(s: {
  cash?: string | null | undefined
  investments?: { value?: string | null | undefined } | null | undefined
  fixedAssets?: string | null | undefined
  receivables?: string | null | undefined
  liabilities?: string | null | undefined
}): PieSlice[] {
  const rows: Array<[string, string, string | null | undefined]> = [
    ['cash', 'Cash', s.cash],
    ['investments', 'Investments', s.investments?.value],
    ['fixed', 'Fixed assets', s.fixedAssets],
    ['owed', 'Money owed to you', s.receivables],
    ['debt', 'Debt', s.liabilities],
  ]
  return rows.flatMap(([key, name, amount]) =>
    amount && toDecimal(amount).greaterThan(0) ? [{ key, name, amount }] : [],
  )
}
