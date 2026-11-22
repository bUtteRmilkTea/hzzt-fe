// biome-ignore-all lint/plugin: fixtures only
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { BASE, makeAuthedHandlers } from '../../../test/msw/api'
import { btc, list, metas, valuation } from '../../../test/msw/investments'
import { server } from '../../../test/msw/server'
import { renderApp } from '../../../test/renderApp'
import { TargetBar } from './TargetBar'
import type { InvestmentView } from './types'

const I = `${BASE}/spaces/s-1/investments`
const base = (v: string) =>
  valuation({
    base: { currency: 'IDR', marketValue: v, costBasis: v, unrealizedPl: '0', fxRate: '1' },
  })
const inv = (id: string, name: string, wrapper: string, value: string, assetType = 'CRYPTO') =>
  ({
    ...btc,
    id,
    name,
    assetType,
    details: { exchangeOrWallet: wrapper },
    valuation: base(value),
  }) as unknown as InvestmentView

// Nine crypto holdings (so the donut folds a tail into Other) plus one stock.
const items = [
  ...Array.from({ length: 9 }, (_, i) =>
    inv(`c${i}`, `Coin ${i}`, i < 5 ? 'Bybit' : 'Binance', String(900 - i * 50)),
  ),
  inv('s1', 'Apple', 'Ajaib', '500', 'US_STOCK'),
]

beforeEach(() => {
  server.use(...makeAuthedHandlers())
  server.use(
    http.get(`${BASE}/investment-types`, () => HttpResponse.json(metas)),
    http.get(`${I}/wrappers`, () =>
      HttpResponse.json({ items: [{ assetType: 'CRYPTO', key: 'bybit', targetPct: '50.00' }] }),
    ),
    http.get(I, () => HttpResponse.json(list(items as never))),
  )
})

describe('portfolio hero (F13-T01)', () => {
  it('puts the value and P/L beside a donut whose legend lists the top 6 plus Other', async () => {
    renderApp('/s/s-1/investments')
    const hero = await screen.findByTestId('portfolio-summary')
    expect(within(hero).getByTestId('portfolio-pl')).toHaveTextContent('+IDR 2,500,000')
    expect(within(hero).getByTestId('portfolio-pl')).toHaveTextContent('(25.51%)')
    const legend = within(hero).getByRole('list', { name: 'Portfolio split by investment legend' })
    const names = within(legend)
      .getAllByRole('listitem')
      .map((li) => li.textContent)
    expect(names).toHaveLength(7)
    expect(names.at(-1)).toContain('Other')
  })

  it('colours slices from the chart token ramp, never greys or raw hex', async () => {
    renderApp('/s/s-1/investments')
    const hero = await screen.findByTestId('portfolio-summary')
    const fills = [...hero.querySelectorAll('path[data-slice]')].map(
      (p) => (p as SVGElement).style.fill,
    )
    expect(fills.length).toBe(7)
    for (const f of fills) expect(f).toMatch(/^var\(--chart-[1-8]\)$/)
    expect(new Set(fills).size).toBe(7)
  })
})

describe('flattened investments list (F13-T02, T03)', () => {
  it('nests at most one card: the type card, with hairline rows inside and no pies per account', async () => {
    renderApp('/s/s-1/investments')
    const crypto = await screen.findByRole('region', { name: 'Crypto' })
    const row = await within(crypto).findByRole('link', { name: /Coin 0/ })
    let cards = 0
    for (let el: Element | null = row; el && el !== document.body; el = el.parentElement)
      if (el.classList.contains('rounded-lg') && el.classList.contains('border')) cards++
    expect(cards).toBe(1)
    expect(row).not.toHaveClass('rounded-lg')
    expect(within(crypto).queryByTestId('pie-chart')).not.toBeInTheDocument()
  })

  it('shows a target-versus-actual bar per account, with the tick at the target', async () => {
    renderApp('/s/s-1/investments')
    const bybit = await screen.findByRole('region', { name: 'CRYPTO Bybit' })
    const bar = within(bybit).getByTestId('target-bar')
    expect(bar).toHaveAccessibleName(/target 50.00%/)
    expect(within(bar).getByTestId('target-tick')).toHaveStyle({ left: '50%' })
  })

  it('splits the type cards into two independent columns', async () => {
    renderApp('/s/s-1/investments')
    const column = async (name: string) =>
      (await screen.findByRole('region', { name }))
        .closest('[data-column]')
        ?.getAttribute('data-column')
    expect(await column('Crypto')).toBe('left')
    expect(await column('US stock')).toBe('right')
  })

  it('collapses an account with a transition and keeps the rows inert', async () => {
    const user = userEvent.setup()
    renderApp('/s/s-1/investments')
    const bybit = await screen.findByRole('region', { name: 'CRYPTO Bybit' })
    await user.click(within(bybit).getByRole('button', { expanded: true }))
    expect(within(bybit).getByText('Coin 0').closest('[inert]')).not.toBeNull()
  })
})

describe('TargetBar', () => {
  it('draws the actual share, clamps bad input, and omits the tick without a target', () => {
    const { rerender } = render(<TargetBar label="X" actualPct="42.5" targetPct={null} />)
    expect(screen.queryByTestId('target-tick')).not.toBeInTheDocument()
    expect(screen.getByTestId('target-bar')).toHaveAccessibleName(
      'X: 42.5% of the category, no target',
    )
    rerender(<TargetBar label="X" actualPct="250" targetPct="-5" />)
    expect(screen.getByTestId('target-tick')).toHaveStyle({ left: '0%' })
  })
})

describe('detail screen (F13-T04)', () => {
  it('counts the hero value up, ends on the server value, and uses flat hairline rows', async () => {
    server.use(http.get(`${I}/c0`, () => HttpResponse.json(items[0])))
    renderApp('/s/s-1/investments/c0')
    const card = await screen.findByTestId('valuation')
    // The screen-reader copy is the exact final value at every frame.
    expect(card.querySelector('.sr-only')).toHaveTextContent('IDR 900')
    for (const line of card.querySelectorAll('p.border-t'))
      expect(line).toHaveClass('border-border')
    expect(card.querySelectorAll('.rounded-lg.border')).toHaveLength(0) // no nested card inside the card
  })
})
