import { describe, expect, it } from 'vitest'
import type { InvestmentView } from '@/features/investments/types'
import { valuation } from '../../../test/msw/investments'
import { accountGroups, capEach } from './breakdown'

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
