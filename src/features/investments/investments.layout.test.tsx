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

describe('portfolio line (F31)', () => {
  const NW = `${BASE}/spaces/s-1/net-worth/history`
  const threeMonths = () => {
    const day = (back: number) => new Date(Date.now() - back * 864e5).toISOString().slice(0, 10)
    return [90, 60, 30, 0].map((b) => ({
      date: day(b),
      netWorth: '1000',
      investments: String(900 + (90 - b)),
    }))
  }

  it('has a line half and a pie half, with the five ranges', async () => {
    const seen: string[] = []
    server.use(
      http.get(NW, ({ request }) => {
        seen.push(new URL(request.url).searchParams.get('range') ?? '')
        return HttpResponse.json({
          currency: 'IDR',
          range: 'x',
          changePct: '1',
          investmentsChangePct: '10.00',
          points: threeMonths(),
        })
      }),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/investments')
    const hero = await screen.findByTestId('portfolio-summary')
    expect(within(hero).getByTestId('portfolio-line')).toBeInTheDocument()
    expect(within(hero).getByTestId('portfolio-pie')).toBeInTheDocument()
    const picker = within(hero).getByRole('radiogroup', { name: 'Portfolio range' })
    expect(
      within(picker)
        .getAllByRole('radio')
        .map((r) => r.textContent),
    ).toEqual(['1M', '3M', '6M', '12M', 'All time'])
    expect(await within(hero).findByTestId('portfolio-change')).toHaveTextContent('+10.00%')
    await user.click(within(picker).getByRole('radio', { name: '12M' }))
    await user.click(within(picker).getByRole('radio', { name: 'All time' }))
    expect(seen).toContain('1Y')
    expect(seen).toContain('ALL')
  })

  it('keeps the chosen 6M and notes that the data only covers 3 months', async () => {
    server.use(
      http.get(NW, () =>
        HttpResponse.json({
          currency: 'IDR',
          range: '6M',
          changePct: '1',
          investmentsChangePct: '10.00',
          points: threeMonths(),
        }),
      ),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/investments')
    const hero = await screen.findByTestId('portfolio-summary')
    const picker = within(hero).getByRole('radiogroup', { name: 'Portfolio range' })
    await user.click(within(picker).getByRole('radio', { name: '6M' }))
    expect(await within(hero).findByTestId('portfolio-coverage')).toHaveTextContent(
      'Your data only covers 3 months.',
    )
    expect(within(picker).getByRole('radio', { name: '6M' })).toBeChecked()
    await user.click(within(picker).getByRole('radio', { name: 'All time' }))
    expect(within(hero).queryByTestId('portfolio-coverage')).not.toBeInTheDocument()
  })

  it('a single point shows the empty state with the note', async () => {
    server.use(
      http.get(NW, () =>
        HttpResponse.json({
          currency: 'IDR',
          range: '1M',
          changePct: null,
          investmentsChangePct: null,
          points: [
            { date: new Date().toISOString().slice(0, 10), netWorth: '1', investments: '1' },
          ],
        }),
      ),
    )
    renderApp('/s/s-1/investments')
    const hero = await screen.findByTestId('portfolio-summary')
    expect(await within(hero).findByText('History starts today.')).toBeInTheDocument()
    expect(within(hero).getByTestId('portfolio-coverage')).toHaveTextContent('1 day')
  })
})

describe('portfolio hero (F13-T01)', () => {
  it('puts the value and P/L beside a donut whose legend lists the top 6 plus Other', async () => {
    const user = userEvent.setup()
    renderApp('/s/s-1/investments')
    const hero = await screen.findByTestId('portfolio-summary')
    await user.click(within(hero).getByRole('radio', { name: 'By asset' }))
    expect(within(hero).getByTestId('portfolio-pl')).toHaveTextContent('+IDR 2,500,000')
    expect(within(hero).getByTestId('portfolio-pl')).toHaveTextContent('(25.51%)')
    const legend = within(hero).getByRole('list', { name: 'Portfolio split by investment legend' })
    const names = within(legend)
      .getAllByRole('listitem')
      .map((li) => li.textContent)
    expect(names).toHaveLength(7)
    expect(names.at(-1)).toContain('Other')
  })

  it('defaults to asset classes, and the switch moves between classes and holdings', async () => {
    const user = userEvent.setup()
    sessionStorage.clear()
    renderApp('/s/s-1/investments')
    const hero = await screen.findByTestId('portfolio-summary')
    const legend = () =>
      within(hero)
        .getAllByRole('listitem')
        .map((li) => li.textContent ?? '')
    expect(within(hero).getByRole('radio', { name: 'By class' })).toBeChecked()
    expect(within(hero).getByRole('list', { name: 'Portfolio split by asset class legend' })).toBe(
      within(hero).getByRole('list', { name: /legend$/ }),
    )
    expect(legend()).toHaveLength(2) // Crypto, US stock
    await user.click(within(hero).getByRole('radio', { name: 'By asset' }))
    expect(legend()).toHaveLength(7)
    expect(
      within(hero).getByRole('list', { name: 'Portfolio split by investment legend' }),
    ).toBeTruthy()
  })

  it('colours slices from the chart token ramp, never greys or raw hex', async () => {
    const user = userEvent.setup()
    sessionStorage.clear()
    renderApp('/s/s-1/investments')
    const hero = await screen.findByTestId('portfolio-summary')
    await user.click(within(hero).getByRole('radio', { name: 'By asset' }))
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
    // The page text is the exact final value; the counting frame is a separate attribute.
    expect(card.querySelector('[data-frame]')).not.toBeNull()
    expect(card).toHaveTextContent('IDR 900')
    for (const line of card.querySelectorAll('p.border-t'))
      expect(line).toHaveClass('border-border')
    expect(card.querySelectorAll('.rounded-lg.border')).toHaveLength(0) // no nested card inside the card
  })
})
