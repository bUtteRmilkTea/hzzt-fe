// biome-ignore-all lint/plugin: fixtures only
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { BASE, makeAuthedHandlers } from '../../../test/msw/api'
import { assetList, debt, house, owed, summary } from '../../../test/msw/assets'
import { btc, list, metas } from '../../../test/msw/investments'
import { server } from '../../../test/msw/server'
import { bank, cash, walletList } from '../../../test/msw/wallets'
import { renderApp } from '../../../test/renderApp'
import { capRows, collapsedSummary } from './AssetsScreen'

const NW = `${BASE}/spaces/s-1/net-worth`
const many = Array.from({ length: 7 }, (_, i) => ({ ...btc, id: `inv-${i}`, name: `Coin ${i}` }))

beforeEach(() => {
  server.use(...makeAuthedHandlers())
  server.use(
    http.get(`${BASE}/investment-types`, () => HttpResponse.json(metas)),
    http.get(`${BASE}/spaces/s-1/wallets`, () => HttpResponse.json(walletList([cash, bank]))),
    http.get(`${BASE}/spaces/s-1/investments`, () => HttpResponse.json(list(many))),
    http.get(`${NW}/summary`, () => HttpResponse.json(summary())),
    http.get(`${NW}/history`, () =>
      HttpResponse.json({
        currency: 'IDR',
        changePct: '5',
        range: '1M',
        points: [
          { date: '2026-10-21', netWorth: '90000000' },
          { date: '2026-11-21', netWorth: '95000000', live: true },
        ],
      }),
    ),
    http.get(`${BASE}/spaces/s-1/manual-assets`, ({ request }) => {
      const kind = new URL(request.url).searchParams.get('kind')
      return HttpResponse.json(
        kind === 'FIXED_ASSET'
          ? assetList('FIXED_ASSET', [house], '50000000')
          : kind === 'RECEIVABLE'
            ? assetList('RECEIVABLE', [owed], '5000000')
            : assetList('LIABILITY', [debt], '30000000'),
      )
    }),
  )
})

describe('collapsedSummary / capRows', () => {
  it('names the count and the first item', () => {
    expect(collapsedSummary([])).toBe('Empty')
    expect(collapsedSummary(['BCA'])).toBe('1 item · BCA')
    expect(collapsedSummary(['BCA', 'Cash', 'Savings'])).toBe('3 items · BCA')
  })
  it('keeps the first N rows across groups and drops emptied groups', () => {
    const groups = [{ rows: [1, 2, 3] }, { rows: [4, 5, 6] }, { rows: [7] }]
    expect(capRows(groups, 5).map((g) => g.rows)).toEqual([
      [1, 2, 3],
      [4, 5],
    ])
    expect(capRows(groups, 99).flatMap((g) => g.rows)).toHaveLength(7)
  })
})

describe('assets layout (F12)', () => {
  it('puts a net worth hero with a drawn line above two independent columns', async () => {
    renderApp('/s/s-1/assets')
    const hero = await screen.findByRole('region', { name: 'Net worth' })
    expect(await within(hero).findByTestId('line-chart')).toBeInTheDocument()
    expect(hero.querySelector('[data-draw]')).not.toBeNull()
    expect(hero.querySelector('[data-counting], .sr-only')).not.toBeNull()

    const column = (name: string) =>
      screen.getByRole('region', { name }).closest('[data-column]')?.getAttribute('data-column')
    expect(column('Cash')).toBe('left')
    expect(column('Fixed assets')).toBe('left')
    expect(column('Debt')).toBe('left')
    expect(column('Investments')).toBe('right')
    expect(column('Money owed to you')).toBe('right')
  })

  it('shows a skeleton chart while history loads, never an empty box', async () => {
    server.use(http.get(`${NW}/history`, () => new Promise(() => {})))
    renderApp('/s/s-1/assets')
    expect(await screen.findByTestId('line-chart-skeleton')).toBeInTheDocument()
  })

  it('collapsing Investments leaves Cash untouched and the summary shows count and first item', async () => {
    const user = userEvent.setup()
    renderApp('/s/s-1/assets')
    const cashRegion = await screen.findByRole('region', { name: 'Cash' })
    const cashHtml = cashRegion.innerHTML
    const inv = screen.getByRole('region', { name: 'Investments' })
    await within(inv).findByText('Coin 0')
    await user.click(within(inv).getByRole('button', { name: 'Investments' }))
    expect(within(inv).getByTestId('section-summary')).toHaveTextContent('7 items · Coin 0')
    expect(screen.getByRole('region', { name: 'Cash' })).toBe(cashRegion)
    expect(cashRegion.innerHTML).toBe(cashHtml)
  })

  it('lists at most 5 investments inline, with a link to open all of them', async () => {
    renderApp('/s/s-1/assets')
    const inv = await screen.findByRole('region', { name: 'Investments' })
    await within(inv).findByText('Coin 0')
    expect(within(inv).getAllByText(/^Coin \d$/)).toHaveLength(5)
    expect(within(inv).queryByText('Coin 5')).not.toBeInTheDocument()
    expect(within(inv).getByRole('link', { name: 'Open all 7 investments' })).toHaveAttribute(
      'href',
      '/s/s-1/investments',
    )
  })
})
