import { metas } from '../../../test/msw/investments'
import {
  buildInvestmentUnion,
  buildTypeSchema,
  decimalPlaces,
  derivedShares,
  quantityScale,
  type TypeFormValues,
  toCreateBody,
  visibleDetailFields,
} from './schema'
import {
  isExactly100,
  isValidPct,
  type ShareRow,
  shareProblem,
  shareTotal,
  toParticipantsBody,
} from './shares'
import { canPreview, exceedsHeld, previewBuy, previewSell, quantityProblem } from './trade'
import type { TypeMeta } from './types'
import { bpsToPct, groupInvestments, isSharedIn, parseValuation } from './valuation'

const meta = (t: string) => metas.find((m) => m.assetType === t) as TypeMeta

const base = {
  name: 'Thing',
  symbol: 'ABC',
  icon: '🪙',
  priceMode: 'MANUAL' as const,
  instrumentId: '',
  quantity: '1',
  avgBuyPrice: '',
  manualPrice: '',
  fees: '',
  manualFxRate: '',
  quoteCurrency: '',
  purchaseDate: '',
  fundingWalletId: '',
  fundingAmount: '',
}
const values = (
  assetType: string,
  over: Record<string, unknown> = {},
  details: Record<string, string> = {},
) => ({ ...base, assetType, details, ...over }) as unknown as TypeFormValues

const ok = (t: string, v: TypeFormValues) => buildTypeSchema(meta(t)).safeParse(v).success
const errors = (t: string, v: TypeFormValues) =>
  buildTypeSchema(meta(t))
    .safeParse(v)
    .error?.issues.map((i) => `${i.path.join('.')}: ${i.message}`) ?? []

describe('per-type required fields (driven by the metadata)', () => {
  it('crypto needs a symbol and a quantity', () => {
    expect(ok('CRYPTO', values('CRYPTO'))).toBe(true)
    expect(errors('CRYPTO', values('CRYPTO', { symbol: '' }))).toContain('symbol: Enter a symbol')
    expect(errors('CRYPTO', values('CRYPTO', { quantity: '0' }))).toContain(
      'quantity: Enter a quantity above 0',
    )
  })
  it('US stock needs an exchange', () => {
    expect(ok('US_STOCK', values('US_STOCK'))).toBe(false)
    expect(errors('US_STOCK', values('US_STOCK'))).toContain(
      'details.exchange: Exchange is required',
    )
    expect(ok('US_STOCK', values('US_STOCK', {}, { exchange: 'NASDAQ' }))).toBe(true)
  })
  it('mutual fund needs a fund type from the list, and a symbol is optional', () => {
    expect(errors('MUTUAL_FUND', values('MUTUAL_FUND', { symbol: '' }))).toContain(
      'details.fundType: Fund type is required',
    )
    expect(
      errors('MUTUAL_FUND', values('MUTUAL_FUND', { symbol: '' }, { fundType: 'NOPE' }))[0],
    ).toMatch(/Choose a fund type/)
    expect(ok('MUTUAL_FUND', values('MUTUAL_FUND', { symbol: '' }, { fundType: 'EQUITY' }))).toBe(
      true,
    )
  })
  it('global ETF needs an exchange; expense ratio must be a number', () => {
    expect(
      ok('GLOBAL_ETF', values('GLOBAL_ETF', {}, { exchange: 'NYSE', expenseRatioPct: 'abc' })),
    ).toBe(false)
    expect(
      ok('GLOBAL_ETF', values('GLOBAL_ETF', {}, { exchange: 'NYSE', expenseRatioPct: '0.03' })),
    ).toBe(true)
  })
  it('Indonesian stock needs lots, a number above 0 with at most one decimal, and no quantity', () => {
    expect(errors('ID_STOCK', values('ID_STOCK', { quantity: '' }))).toContain(
      'details.lots: Lots is required',
    )
    expect(ok('ID_STOCK', values('ID_STOCK', { quantity: '' }, { lots: '2.5' }))).toBe(true)
    expect(ok('ID_STOCK', values('ID_STOCK', { quantity: '' }, { lots: '2.55' }))).toBe(false)
    expect(ok('ID_STOCK', values('ID_STOCK', { quantity: '' }, { lots: '0' }))).toBe(false)
    expect(ok('ID_STOCK', values('ID_STOCK', { quantity: '' }, { lots: '2' }))).toBe(true)
  })
  it('limits name and symbol lengths like the backend', () => {
    expect(ok('CRYPTO', values('CRYPTO', { name: 'x'.repeat(61) }))).toBe(false)
    expect(ok('CRYPTO', values('CRYPTO', { symbol: 'X'.repeat(21) }))).toBe(false)
  })
  it('staked quantity is gone: a leftover value neither fails nor is sent', () => {
    expect(ok('CRYPTO', values('CRYPTO', { quantity: '1' }, { stakedQuantity: '2' }))).toBe(true)
    const body = toCreateBody(
      values('CRYPTO', { quantity: '1' }, { stakedQuantity: '2', network: 'Bitcoin' }),
      meta('CRYPTO'),
    )
    expect(body.details).toEqual({ network: 'Bitcoin' })
  })
  it('the wrapper detail fields are never drawn or sent: the wrapper field asks once (R7)', () => {
    for (const t of ['CRYPTO', 'ID_STOCK', 'US_STOCK', 'GLOBAL_ETF', 'MUTUAL_FUND']) {
      const names = visibleDetailFields(meta(t)).map((f) => f.name)
      for (const hidden of ['broker', 'exchangeOrWallet', 'platform', 'stakedQuantity'])
        expect(names).not.toContain(hidden)
    }
    // the listing exchange of a stock or ETF is a different fact and stays
    expect(visibleDetailFields(meta('US_STOCK')).map((f) => f.name)).toContain('exchange')
    const body = toCreateBody(
      values('CRYPTO', { wrapper: 'Binance' }, { exchangeOrWallet: 'Bybit', network: 'Bitcoin' }),
      meta('CRYPTO'),
    )
    expect(body.wrapper).toBe('Binance')
    expect(body.details).toEqual({ network: 'Bitcoin' })
  })
  it('expected yearly change is not part of the body any more', () => {
    const body = toCreateBody(
      values('CRYPTO', { estimatedAnnualChangePct: '5.5' }) as never,
      meta('CRYPTO'),
    )
    expect(body).not.toHaveProperty('estimatedAnnualChangePct')
  })
})

describe('lots', () => {
  it('2 lots of an Indonesian stock is 200 shares, derived', () => {
    expect(derivedShares('2', 100)).toBe('200')
    expect(derivedShares('15', 100)).toBe('1500')
  })
  it('a lot may have one decimal: 0.5 lot is 50 shares, 2.5 lots is 250', () => {
    expect(derivedShares('0.5', 100)).toBe('50')
    expect(derivedShares('2.5', 100)).toBe('250')
  })
  it('shows nothing until lots is a valid number with at most one decimal', () => {
    for (const bad of ['', '0', '1.55', 'x', '-1']) expect(derivedShares(bad, 100)).toBeNull()
  })
  it('does not send a quantity for a lots type, only details.lots as a number', () => {
    const body = toCreateBody(
      values('ID_STOCK', { quantity: '', symbol: 'bbca' }, { lots: '2', broker: 'Stockbit' }),
      meta('ID_STOCK'),
    )
    expect(body).not.toHaveProperty('quantity')
    expect(body.details).toEqual({ lots: 2 }) // the broker goes through the wrapper field now
    expect(body.symbol).toBe('BBCA')
  })
})

describe('auto pricing', () => {
  it('cannot be submitted without a resolved instrument id', () => {
    const v = values('CRYPTO', { priceMode: 'AUTO', instrumentId: '', symbol: '' })
    expect(errors('CRYPTO', v)).toContain(
      'instrumentId: Search and choose an instrument for automatic pricing.',
    )
    expect(ok('CRYPTO', values('CRYPTO', { priceMode: 'AUTO', instrumentId: 'inst-1' }))).toBe(true)
  })
  it('a symbol is enough: the server resolves it to an instrument', () => {
    expect(ok('CRYPTO', values('CRYPTO', { priceMode: 'AUTO', instrumentId: '' }))).toBe(true)
  })
  it('is refused for types that do not support it (Indonesian stocks, mutual funds)', () => {
    expect(
      errors(
        'ID_STOCK',
        values('ID_STOCK', { priceMode: 'AUTO', quantity: '' }, { lots: '1' }),
      ).join(),
    ).toMatch(/Automatic pricing is not available/)
    expect(
      errors(
        'MUTUAL_FUND',
        values('MUTUAL_FUND', { priceMode: 'AUTO', symbol: '' }, { fundType: 'EQUITY' }),
      ).join(),
    ).toMatch(/Automatic pricing is not available/)
  })
  it('sends the instrument id only in auto mode, and the manual price only in manual mode', () => {
    const auto = toCreateBody(
      values('CRYPTO', { priceMode: 'AUTO', instrumentId: 'inst-1', manualPrice: '5' }),
      meta('CRYPTO'),
    )
    expect(auto).toMatchObject({ priceMode: 'AUTO', instrumentId: 'inst-1' })
    expect(auto).not.toHaveProperty('manualPrice')
    const manual = toCreateBody(
      values('CRYPTO', { priceMode: 'MANUAL', instrumentId: 'inst-1', manualPrice: '5' }),
      meta('CRYPTO'),
    )
    expect(manual).toMatchObject({ manualPrice: '5' })
    expect(manual).not.toHaveProperty('instrumentId')
  })
})

describe('request body', () => {
  it('omits empty optional fields and keeps decimals as strings', () => {
    const body = toCreateBody(
      values('CRYPTO', { quantity: '0.0125', avgBuyPrice: '50000.5' }),
      meta('CRYPTO'),
    )
    expect(body).toMatchObject({ assetType: 'CRYPTO', quantity: '0.0125', avgBuyPrice: '50000.5' })
    for (const k of ['fees', 'manualPrice', 'purchaseDate', 'manualFxRate', 'funding', 'details'])
      expect(body).not.toHaveProperty(k)
  })
  it('sends a free quote currency only for types that allow it', () => {
    expect(
      toCreateBody(
        values('MUTUAL_FUND', { symbol: '', quoteCurrency: 'IDR' }, { fundType: 'EQUITY' }),
        meta('MUTUAL_FUND'),
      ),
    ).toMatchObject({ quoteCurrency: 'IDR' })
    expect(
      toCreateBody(values('CRYPTO', { quoteCurrency: 'IDR' }), meta('CRYPTO')),
    ).not.toHaveProperty('quoteCurrency')
  })
  it('adds the funding wallet (and an optional amount) as the backend expects', () => {
    expect(
      toCreateBody(values('CRYPTO', { fundingWalletId: 'w-1' }), meta('CRYPTO')).funding,
    ).toEqual({ walletId: 'w-1' })
    expect(
      toCreateBody(
        values('CRYPTO', { fundingWalletId: 'w-1', fundingAmount: '1000' }),
        meta('CRYPTO'),
      ).funding,
    ).toEqual({ walletId: 'w-1', amount: '1000' })
  })
  it('needs a funding wallet when an amount is given', () => {
    expect(errors('CRYPTO', values('CRYPTO', { fundingAmount: '1000' }))).toContain(
      'fundingWalletId: Choose the wallet that pays for it.',
    )
  })
})

describe('discriminated union on assetType', () => {
  const union = buildInvestmentUnion(metas)
  it('routes each payload to its own type schema', () => {
    expect(union.safeParse(values('US_STOCK', {}, { exchange: 'NASDAQ' })).success).toBe(true)
    expect(union.safeParse(values('US_STOCK')).success).toBe(false) // missing exchange
  })
  it('rejects an unknown asset type', () => {
    expect(union.safeParse(values('LAND')).success).toBe(false)
  })
})

describe('shares', () => {
  const row = (sharePct: string, over: Partial<ShareRow> = {}): ShareRow => ({
    key: sharePct + Math.random(),
    isOwner: false,
    displayName: 'Bob',
    email: '',
    sharePct,
    ...over,
  })
  const owner = (sharePct: string) => row(sharePct, { isOwner: true, displayName: 'Me' })

  it('adds exactly (no binary floating point drift)', () => {
    expect(shareTotal([row('33.33'), row('33.33'), row('33.34')]).toFixed(2)).toBe('100.00')
    expect(isExactly100([row('33.33'), row('33.33'), row('33.34')])).toBe(true)
    expect(isExactly100([row('0.1'), row('0.2'), row('99.7')])).toBe(true)
  })
  it('99.99 cannot be submitted, and neither can 100.01', () => {
    expect(isExactly100([owner('50'), row('49.99')])).toBe(false)
    expect(shareProblem([owner('50'), row('49.99')])).toBe('Shares must add up to exactly 100.00%.')
    expect(shareProblem([owner('50'), row('50.01')])).toBe('Shares must add up to exactly 100.00%.')
  })
  it('50 / 50 is fine', () => {
    expect(shareProblem([owner('50'), row('50')])).toBeNull()
  })
  it('requires the owner to keep a share above 0', () => {
    expect(shareProblem([owner('0'), row('100')])).toBe('You must keep a share above 0%.')
    expect(shareProblem([row('100')])).toBe('You must keep a share above 0%.')
  })
  it('validates percentages and counts', () => {
    for (const bad of ['', 'abc', '1.234', '101', '-1', '1e2'])
      expect(isValidPct(bad), bad).toBe(false)
    for (const good of ['0', '12.5', '100', '100.00', '0.01'])
      expect(isValidPct(good), good).toBe(true)
    const eleven = Array.from({ length: 11 }, (_, i) =>
      row(i === 0 ? '10' : '9', { isOwner: i === 0 }),
    )
    expect(shareProblem(eleven)).toMatch(/At most 10/)
  })
  it('needs names and plausible emails', () => {
    expect(shareProblem([owner('50'), row('50', { displayName: ' ' })])).toBe(
      'Everyone needs a name.',
    )
    expect(shareProblem([owner('50'), row('50', { email: 'nope' })])).toBe(
      'Check the email addresses.',
    )
  })
  it('builds the full-replacement body with two-decimal shares', () => {
    expect(
      toParticipantsBody([owner('50'), row('50', { email: 'b@x.co', displayName: 'Bob' })]),
    ).toEqual({
      participants: [
        { displayName: 'Me', sharePct: '50.00', isOwner: true },
        { displayName: 'Bob', sharePct: '50.00', email: 'b@x.co' },
      ],
    })
  })
})

describe('trade previews (the backend formulas)', () => {
  const pos = { quantity: '10', avgBuyPrice: '100' }
  it('BUY: new quantity and weighted average, cash includes the fee', () => {
    const p = previewBuy(pos, '10', '200', '5')
    expect(p.quantity).toBe('20')
    expect(p.avgBuyPrice).toBe('150')
    expect(p.cash).toBe('2005')
    expect(p.realizedPl).toBeNull()
  })
  it('BUY into an empty position uses the buy price as the average', () => {
    expect(previewBuy({ quantity: '0', avgBuyPrice: '0' }, '2', '50', '').avgBuyPrice).toBe('50')
  })
  it('SELL: quantity falls, average stays, realised P/L nets the fee', () => {
    const p = previewSell(pos, '4', '150', '10')
    expect(p.quantity).toBe('6')
    expect(p.avgBuyPrice).toBe('100')
    expect(p.cash).toBe('590')
    expect(p.realizedPl).toBe('190') // (150 - 100) x 4 - 10
  })
  it('stays exact with awkward decimals', () => {
    expect(previewBuy({ quantity: '0.1', avgBuyPrice: '3' }, '0.2', '3', '').quantity).toBe('0.3')
  })
  it('only previews valid input', () => {
    expect(canPreview('1', '2', '')).toBe(true)
    expect(canPreview('0', '2', '')).toBe(false)
    expect(canPreview('1', '', '')).toBe(false)
    expect(canPreview('1', '2', '-1')).toBe(false)
  })
  it('a sale is limited by the held quantity only', () => {
    expect(exceedsHeld('10', '10')).toBe(false)
    expect(exceedsHeld('10', '10.01')).toBe(true)
    expect(exceedsHeld('10', '')).toBe(false)
  })
})

describe('valuation parsing', () => {
  it('reads the real shape and keeps strings exact', () => {
    const v = parseValuation({
      price: '65000',
      priceSource: 'MARKET',
      priceAsOf: '2026-01-01T00:00:00Z',
      isStale: true,
      marketValue: '650.5',
      costBasis: '500',
      unrealizedPl: '150.5',
      unrealizedPlPct: '30.1',
      base: {
        currency: 'IDR',
        marketValue: '1',
        costBasis: '2',
        unrealizedPl: '3',
        fxRate: '16000',
      },
      warnings: [{ message: 'x' }],
    })
    expect(v).toMatchObject({
      isStale: true,
      marketValue: '650.5',
      unrealizedPlPct: '30.1',
      base: { currency: 'IDR', fxRate: '16000' },
    })
    expect(v?.warnings).toHaveLength(1)
  })
  it('handles a missing base (no FX rate) and a null percentage', () => {
    const v = parseValuation({
      marketValue: '5',
      costBasis: '0',
      unrealizedPl: '5',
      unrealizedPlPct: null,
      base: null,
    })
    expect(v?.base).toBeNull()
    expect(v?.unrealizedPlPct).toBeNull()
  })
  it('returns null for nothing usable', () => {
    for (const bad of [undefined, null, 'x', {}, 5]) expect(parseValuation(bad)).toBeNull()
  })
})

describe('shares and grouping helpers', () => {
  it('formats basis points as percentages', () => {
    expect(bpsToPct(10000)).toBe('100.00')
    expect(bpsToPct(2500)).toBe('25.00')
    expect(bpsToPct(3333)).toBe('33.33')
    expect(bpsToPct(1)).toBe('0.01')
    expect(bpsToPct(undefined)).toBe('0.00')
  })
  it('recognises shared-in', () => {
    expect(isSharedIn({ ownership: 'SHARED_IN' })).toBe(true)
    expect(isSharedIn({ ownership: 'OWNER' })).toBe(false)
  })
  it('groups by asset type in a stable display order', () => {
    const groups = groupInvestments([
      { id: '1', assetType: 'MUTUAL_FUND' },
      { id: '2', assetType: 'CRYPTO' },
      { id: '3', assetType: 'CRYPTO' },
      { id: '4', assetType: 'ID_STOCK' },
    ])
    expect(groups.map((g) => [g.assetType, g.items.length])).toEqual([
      ['CRYPTO', 2],
      ['ID_STOCK', 1],
      ['MUTUAL_FUND', 1],
    ])
  })
})

describe('quantity decimal limits', () => {
  it('crypto allows 8 decimals, not 9', () => {
    expect(ok('CRYPTO', values('CRYPTO', { quantity: '0.12345678' }))).toBe(true)
    expect(errors('CRYPTO', values('CRYPTO', { quantity: '0.123456789' }))).toContain(
      'quantity: Use at most 8 decimal places',
    )
  })
  it('US stock allows 1 decimal, not 2', () => {
    const d = { exchange: 'NASDAQ' }
    expect(ok('US_STOCK', values('US_STOCK', { quantity: '1.5' }, d))).toBe(true)
    expect(errors('US_STOCK', values('US_STOCK', { quantity: '1.25' }, d))).toContain(
      'quantity: Use at most 1 decimal place',
    )
  })
  it('Indonesian stock lots allow 1 decimal', () => {
    const lots = (n: string) => values('ID_STOCK', { quantity: '' }, { lots: n })
    expect(ok('ID_STOCK', lots('2.5'))).toBe(true)
    expect(ok('ID_STOCK', lots('0.5'))).toBe(true)
    expect(errors('ID_STOCK', lots('1.55')).join()).toContain('use at most 1 decimal place')
  })
  it('helpers', () => {
    expect(decimalPlaces('1.25')).toBe(2)
    expect(decimalPlaces('3')).toBe(0)
    expect(quantityScale('CRYPTO')).toBe(8)
    expect(quantityScale('GLOBAL_ETF')).toBe(18)
    expect(quantityScale('CRYPTO', { quantityScale: 4 })).toBe(4)
  })
  it('a trade quantity follows the same limit, ID stock in multiples of 10 shares', () => {
    expect(quantityProblem('CRYPTO', '0.00000001')).toBeNull()
    expect(quantityProblem('CRYPTO', '0.000000001')).not.toBeNull()
    expect(quantityProblem('US_STOCK', '2.5')).toBeNull()
    expect(quantityProblem('US_STOCK', '2.55')).not.toBeNull()
    expect(quantityProblem('ID_STOCK', '50')).toBeNull()
    expect(quantityProblem('ID_STOCK', '55')).not.toBeNull()
    expect(quantityProblem('GLOBAL_ETF', '0.123456789')).toBeNull()
    expect(quantityProblem('CRYPTO', '')).toBeNull()
  })
})
