// biome-ignore-all lint/plugin: fixtures only
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { Decimal } from '@/shared/money'
import { BASE, errorEnvelope, makeAuthedHandlers } from '../../../test/msw/api'
import { btc, list, metas, valuation } from '../../../test/msw/investments'
import { server } from '../../../test/msw/server'
import { renderApp } from '../../../test/renderApp'
import type { InvestmentView } from './types'
import { categorySlices, groupInvestments, unionSlices, wrapperOf } from './valuation'
import { checkTargetPct } from './wrappers'

const I = `${BASE}/spaces/s-1/investments`
const base = (v: string) =>
  valuation({
    base: { currency: 'IDR', marketValue: v, costBasis: v, unrealizedPl: '0', fxRate: '1' },
  })
const inv = (
  id: string,
  name: string,
  wrapper: string | null,
  value: string,
  assetType = 'CRYPTO',
) =>
  ({
    ...btc,
    id,
    name,
    assetType,
    ...(wrapper ? { details: { exchangeOrWallet: wrapper } } : { details: {} }),
    valuation: base(value),
  }) as unknown as InvestmentView

const items = [
  inv('a', 'Bitcoin', 'Binance', '600000'),
  inv('b', 'Ether', 'binance ', '200000'),
  inv('c', 'Solana', 'Bybit', '200000'),
  inv('d', 'Dogecoin', null, '100000'),
]

describe('groupInvestments (two-level)', () => {
  it('sums with Decimal per category and wrapper, merges case/space variants, unassigned last', () => {
    const [crypto] = groupInvestments(items)
    expect(crypto?.value).toBe('1100000')
    expect(crypto?.wrappers.map((w) => [w.key, w.label, w.value, w.count])).toEqual([
      ['binance', 'Binance', '800000', 2],
      ['bybit', 'Bybit', '200000', 1],
      ['_unassigned', 'Unassigned', '100000', 1],
    ])
    expect(crypto?.wrappers.map((w) => w.pctOfCategory)).toEqual(['72.73', '18.18', '9.09'])
  })
  it('does not lose cents to float error and skips items with no base value', () => {
    const [g] = groupInvestments([
      inv('x', 'X', 'A', '0.1'),
      inv('y', 'Y', 'A', '0.2'),
      { ...inv('z', 'Z', 'A', '5'), valuation: valuation({ base: null }) },
    ])
    expect(g?.value).toBe('0.3')
    expect(g?.wrappers[0]?.count).toBe(3)
  })
  it('reads the wrapper field first, then details', () => {
    expect(wrapperOf({ ...inv('q', 'Q', 'Details', '1'), wrapper: 'Own' } as never).label).toBe(
      'Own',
    )
    expect(wrapperOf(inv('q', 'Q', 'Details', '1')).key).toBe('details')
  })
  it('categorySlices: one slice per type in display order, summing to the portfolio, skipping a type with no rate', () => {
    const label = (t: string) => `L:${t}`
    const s = categorySlices(
      [
        inv('a', 'A', 'W', '10', 'US_STOCK'),
        inv('b', 'B', 'W', '20.5', 'CRYPTO'),
        inv('c', 'C', 'W', '4.5', 'CRYPTO'),
        { ...inv('d', 'D', 'W', '9', 'GLOBAL_ETF'), valuation: valuation({ base: null }) },
      ],
      label,
    )
    expect(s).toEqual([
      { key: 'CRYPTO', name: 'L:CRYPTO', amount: '25' },
      { key: 'US_STOCK', name: 'L:US_STOCK', amount: '10' },
    ])
  })
})

describe('unionSlices (D-F54)', () => {
  const sym = (i: InvestmentView, symbol: string | null) => ({ ...i, symbol }) as InvestmentView
  it('merges the same symbol held on two wrappers into one slice with its accounts', () => {
    const s = unionSlices([
      sym(inv('a', 'Bitcoin', 'Binance', '600'), 'BTC'),
      sym(inv('b', 'Bitcoin', 'Hyperliquid', '400'), 'btc'),
      sym(inv('c', 'Ether', 'Binance', '300'), 'ETH'),
    ])
    expect(s.map((x) => [x.key, x.name, x.amount, x.accounts])).toEqual([
      ['CRYPTO:BTC', 'BTC, 2 accounts', '1000', 2],
      ['CRYPTO:ETH', 'Ether', '300', 1],
    ])
    expect(s[0]?.detail).toBe('Binance 60.00%, Hyperliquid 40.00%')
    expect(s[0]?.parts).toEqual([
      { wrapper: 'Binance', amount: '600' },
      { wrapper: 'Hyperliquid', amount: '400' },
    ])
    expect(s[1]?.detail).toBeUndefined()
  })
  it('keeps the same symbol of another asset type apart and never merges funds without a symbol', () => {
    const s = unionSlices([
      sym(inv('a', 'Apple', 'X', '10', 'US_STOCK'), 'AAPL'),
      sym(inv('b', 'Apple CFD', 'X', '5', 'GLOBAL_ETF'), 'AAPL'),
      sym(inv('c', 'Fund A', 'X', '4', 'MUTUAL_FUND'), null),
      sym(inv('d', 'Fund B', 'X', '3', 'MUTUAL_FUND'), null),
    ])
    expect(s.map((x) => x.key)).toEqual(['US_STOCK:AAPL', 'GLOBAL_ETF:AAPL', 'c', 'd'])
  })
  it('skips holdings without a base value, and folds nothing into Other', () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      sym(inv(`i${i}`, `N${i}`, 'W', String(100 - i)), `S${i}`),
    )
    many.push({
      ...many[0],
      id: 'nr',
      symbol: 'ZZZ',
      valuation: valuation({ base: null }),
    } as never)
    const s = unionSlices(many)
    expect(s).toHaveLength(25)
    expect(s.some((x) => x.name === 'Other')).toBe(false)
    expect(s[0]?.amount).toBe('100')
  })
})

describe('checkTargetPct', () => {
  it('accepts empty (clear), 2 decimals, and rejects over 100, 3 decimals and sums above 100', () => {
    expect(checkTargetPct('', new Decimal(0))).toEqual({ ok: true, value: null })
    expect(checkTargetPct('40.5', new Decimal(0))).toEqual({ ok: true, value: '40.50' })
    expect(checkTargetPct('101', new Decimal(0)).ok).toBe(false)
    expect(checkTargetPct('1.234', new Decimal(0)).ok).toBe(false)
    const over = checkTargetPct('50', new Decimal(60))
    expect(over.ok).toBe(false)
    expect(over.ok === false && over.message).toContain('40.00%')
  })
})

describe('investments screen with wrappers', () => {
  beforeEach(() => {
    server.use(...makeAuthedHandlers())
    server.use(
      http.get(`${BASE}/investment-types`, () => HttpResponse.json(metas)),
      http.get(I, () =>
        HttpResponse.json(list(items as never, { totalValue: '1100000', totalCost: '1100000' })),
      ),
    )
  })

  it('shows Crypto, then Binance and Bybit, each with its sum', async () => {
    renderApp('/s/s-1/investments')
    const crypto = await screen.findByRole('region', { name: 'Crypto' })
    expect(within(crypto).getByRole('heading', { name: 'Crypto' })).toBeInTheDocument()
    expect(within(crypto).getAllByText('IDR 1,100,000').length).toBeGreaterThan(0)
    const binance = within(crypto).getByRole('region', { name: 'CRYPTO Binance' })
    expect(within(binance).getAllByText('IDR 800,000').length).toBeGreaterThan(0)
    const bybit = within(crypto).getByRole('region', { name: 'CRYPTO Bybit' })
    expect(within(bybit).getAllByText('IDR 200,000').length).toBeGreaterThan(0)
    expect(within(crypto).getByRole('region', { name: 'CRYPTO Unassigned' })).toBeInTheDocument()
  })

  it('edits one wrapper percent inline: Enter saves via PATCH, optimistic, Esc cancels', async () => {
    let body: unknown
    let url = ''
    let stored: unknown[] = []
    server.use(
      http.get(`${I}/wrappers`, () => HttpResponse.json({ items: stored })),
      http.patch(`${I}/wrappers/CRYPTO/binance`, async ({ request }) => {
        body = await request.json()
        url = request.url
        stored = [{ assetType: 'CRYPTO', key: 'binance', targetPct: '40.00' }]
        return HttpResponse.json({ assetType: 'CRYPTO', targetPct: '40.00' })
      }),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/investments')
    const binance = await screen.findByRole('region', { name: 'CRYPTO Binance' })
    await user.click(within(binance).getByRole('button', { name: /Binance target not set/ }))
    await user.type(within(binance).getByLabelText('Binance target percent'), '40{Enter}')
    await waitFor(() => expect(body).toEqual({ targetPct: '40.00' }))
    expect(url).toContain('/wrappers/CRYPTO/binance')
    expect(await within(binance).findByText('Target 40.00%')).toBeInTheDocument()

    await user.click(within(binance).getByRole('button', { name: /Binance target 40.00%, edit/ }))
    await user.type(within(binance).getByLabelText('Binance target percent'), '{Escape}')
    expect(within(binance).getByText('Target 40.00%')).toBeInTheDocument()
  })

  it('blocks a percent that would pass 100 in the category, with no request', async () => {
    let patched = false
    server.use(
      http.get(`${I}/wrappers`, () =>
        HttpResponse.json({
          items: [{ assetType: 'CRYPTO', key: 'bybit', targetPct: '70.00' }],
        }),
      ),
      http.patch(`${I}/wrappers/CRYPTO/binance`, () => {
        patched = true
        return HttpResponse.json({})
      }),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/investments')
    const binance = await screen.findByRole('region', { name: 'CRYPTO Binance' })
    await user.click(within(binance).getByRole('button', { name: /Binance target/ }))
    await user.type(within(binance).getByLabelText('Binance target percent'), '40{Enter}')
    expect(await within(binance).findByRole('alert')).toHaveTextContent('Only 30.00% is left')
    expect(patched).toBe(false)
  })

  it('rolls back and shows the server error when the PATCH fails', async () => {
    server.use(
      http.patch(`${I}/wrappers/CRYPTO/binance`, () =>
        HttpResponse.json(errorEnvelope('ALLOCATION_EXCEEDS_100'), { status: 422 }),
      ),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/investments')
    const binance = await screen.findByRole('region', { name: 'CRYPTO Binance' })
    await user.click(within(binance).getByRole('button', { name: /Binance target/ }))
    await user.type(within(binance).getByLabelText('Binance target percent'), '40{Enter}')
    await waitFor(() =>
      expect(within(binance).getByRole('button', { name: /target not set/ })).toBeInTheDocument(),
    )
  })
})
