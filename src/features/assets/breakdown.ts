import { rowFigures } from '@/features/investments/InvestmentRow'
import type { InvestmentView } from '@/features/investments/types'
import { groupInvestments, parseValuation } from '@/features/investments/valuation'
import type { WalletDTO } from '@/shared/api/wallets'
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
