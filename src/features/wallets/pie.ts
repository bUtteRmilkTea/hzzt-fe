import type { PieSlice } from '@/shared/charts'
import type { WalletExt } from './display'
import type { WalletList } from './hooks'

/**
 * Pie data for the wallet list: each wallet's value in the base currency. Uses the server's
 * `baseBalance` / `pctOfTotal` when present; otherwise only wallets already in the total's
 * currency can be shown (no client-side FX). Wallets with no usable value are left out.
 */
export function walletPieSlices(list: WalletList | undefined, baseCurrency: string): PieSlice[] {
  if (!list) return []
  const base = list.total.currency || baseCurrency
  const out: PieSlice[] = []
  for (const w of list.items as WalletExt[]) {
    const amount = w.baseBalance ?? (w.currency === base ? w.balance : null)
    if (amount == null) continue
    out.push({ key: w.id as string, name: w.name ?? '', amount, pct: w.pctOfTotal ?? null })
  }
  // Mixed server/local percentages would not add up: only trust server pct when every slice has one.
  return out.every((s) => s.pct) ? out : out.map((s) => ({ ...s, pct: null }))
}
