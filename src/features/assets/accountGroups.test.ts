import { describe, expect, it } from 'vitest'
import type { InvestmentView } from '@/features/investments/types'
import { valuation } from '../../../test/msw/investments'
import { accountGroups, capEach, topAccounts } from './breakdown'

const inv = (
  id: string,
  name: string,
  assetType: string,
  baseValue: string,
  wrapper?: string,
): InvestmentView =>
  ({
    id,
    name,
    symbol: name.slice(0, 3).toUpperCase(),
    icon: '🪙',
    assetType,
    quoteCurrency: 'USD',
    ...(wrapper ? { wrapper } : {}),
    valuation: valuation({
      base: {
        currency: 'IDR',
        marketValue: baseValue,
        costBasis: baseValue,
        unrealizedPl: '0',
        fxRate: '1',
      },
    }),
  }) as unknown as InvestmentView

const label = (t: string) => (t === 'CRYPTO' ? 'Crypto' : 'US stock')

describe('accountGroups (F15-T06, D-F18)', () => {
  const items = [
    inv('1', 'Bitcoin', 'CRYPTO', '600', 'Bybit'),
    inv('2', 'Ether', 'CRYPTO', '200', 'bybit '), // same wrapper, different case and spacing
    inv('3', 'Apple', 'US_STOCK', '150', 'Ajaib'),
    inv('4', 'Gold', 'CRYPTO', '50'), // no wrapper
  ]

  it('groups by broker or exchange across asset types, biggest first, "Other" last', () => {
    const g = accountGroups(items, label, 's-1')
    expect(g.map((x) => x.title)).toEqual(['Bybit', 'Ajaib', 'Other'])
    expect(g[0]?.rows.map((r) => r.name)).toEqual(['Bitcoin', 'Ether'])
  })

  it('totals each group exactly and gives shares that add up to 100.00', () => {
    const g = accountGroups(items, label, 's-1')
    expect(g.map((x) => x.total?.value)).toEqual(['800', '150', '50'])
    const pcts = g.map((x) => Number(/ · ([\d.]+)%/.exec(x.subtitle ?? '')?.[1]))
    expect(pcts.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 5)
    expect(g[0]?.subtitle).toBe('2 holdings · 80.00%')
    expect(g[1]?.subtitle).toBe('1 holding · 15.00%')
  })

  it("puts the asset type on each row's second line", () => {
    const g = accountGroups(items, label, 's-1')
    expect(g[1]?.rows[0]?.sub).toBe('APP · US stock')
  })

  it('returns no groups for no investments', () => {
    expect(accountGroups([], label, 's-1')).toEqual([])
  })
})

describe('topAccounts (D-F56)', () => {
  const many = [
    inv('1', 'Bitcoin', 'CRYPTO', '600', 'Bybit'),
    inv('2', 'Apple', 'US_STOCK', '300', 'Ajaib'),
    inv('3', 'Ether', 'CRYPTO', '200', 'Binance'),
    inv('4', 'Solana', 'CRYPTO', '100', 'Kraken'),
    inv('5', 'Dogecoin', 'CRYPTO', '90', 'Kraken'),
    inv('6', 'Gold', 'CRYPTO', '50'), // no wrapper
  ]
  const withPl = many.map((i, n) => {
    const v = i.valuation as unknown as { base: { unrealizedPl: string } }
    v.base.unrealizedPl = n === 1 ? '-30' : '60'
    return i
  })

  it('keeps the three biggest named accounts and counts the rest, never showing "no broker" as an account', () => {
    const t = topAccounts(withPl, label, 's-1', 3)
    expect(t.groups.map((g) => g.title)).toEqual(['Bybit', 'Ajaib', 'Binance'])
    expect(t.moreAccounts).toBe(1)
    expect(t.moreHoldings).toBe(3) // Kraken has 2, the holding with no broker is only counted
  })

  it('gives each account its value, signed PnL and share, and leaves the percent to the server', () => {
    const t = topAccounts(withPl, label, 's-1', 3)
    expect(t.groups[1]?.total?.value).toBe('300')
    expect(t.groups[1]?.pl).toEqual({ amount: '-30', pct: null })
    expect(t.groups[0]?.pl?.amount).toBe('60')
    expect(t.groups[0]?.subtitle).toBe('44.78% of portfolio · 1 holding')
  })

  it('has no more line for three accounts or fewer', () => {
    const t = topAccounts(withPl.slice(0, 3), label, 's-1', 3)
    expect(t.moreAccounts).toBe(0)
  })
})

describe('capEach', () => {
  it('caps rows in every group and records what was left out', () => {
    const groups = [
      { key: 'a', rows: [1, 2, 3, 4, 5, 6, 7].map((n) => ({ key: String(n) })) },
      { key: 'b', rows: [1, 2].map((n) => ({ key: String(n) })) },
    ] as never
    const out = capEach(groups, 5)
    expect(out[0]?.rows).toHaveLength(5)
    expect(out[0]?.more).toBe(2)
    expect(out[1]?.rows).toHaveLength(2)
    expect(out[1]?.more).toBeUndefined()
  })
})
