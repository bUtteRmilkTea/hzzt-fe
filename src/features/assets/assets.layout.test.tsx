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
  it('shows the count only', () => {
    expect(collapsedSummary(0)).toBe('Empty')
    expect(collapsedSummary(1)).toBe('1 item')
    expect(collapsedSummary(3)).toBe('3 items')
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
    expect(hero.querySelector('[data-frame]')).not.toBeNull()

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

  it('collapsing Investments leaves Cash untouched and the summary shows the count only', async () => {
    const user = userEvent.setup()
    renderApp('/s/s-1/assets')
    const cashRegion = await screen.findByRole('region', { name: 'Cash' })
    // The count-up frame is an attribute that changes while counting; the structure must not.
    const structure = (el: HTMLElement) =>
      el.innerHTML.replace(/ data-frame="[^"]*"/g, '').replace(/ data-counting=""/g, '')
    const cashHtml = structure(cashRegion)
    const inv = screen.getByRole('region', { name: 'Investments' })
    await within(inv).findByText('Coin 0')
    await user.click(within(inv).getByRole('button', { name: 'Investments' }))
    expect(within(inv).getByTestId('section-summary')).toHaveTextContent(/^7 items$/)
    expect(screen.getByRole('region', { name: 'Cash' })).toBe(cashRegion)
    expect(structure(cashRegion)).toBe(cashHtml)
  })

  it('uses icon links for Cash and Investments, with no text buttons', async () => {
    renderApp('/s/s-1/assets')
    const cashRegion = await screen.findByRole('region', { name: 'Cash' })
    expect(within(cashRegion).getByRole('link', { name: 'Open wallets' })).toHaveAttribute(
      'href',
      '/s/s-1/wallets',
    )
    const inv = screen.getByRole('region', { name: 'Investments' })
    expect(within(inv).getByRole('link', { name: 'Open investments' })).toHaveAttribute(
      'href',
      '/s/s-1/investments',
    )
    expect(within(inv).queryByText('Open')).not.toBeInTheDocument()
    expect(within(cashRegion).queryByText('Wallets')).not.toBeInTheDocument()
  })

  it('a broker group is a dropdown: the first is open, the others closed, and it toggles', async () => {
    const user = userEvent.setup()
    renderApp('/s/s-1/assets')
    const inv = await screen.findByRole('region', { name: 'Investments' })
    await within(inv).findByText('Coin 0')
    const toggles = within(inv)
      .queryAllByRole('button', { expanded: false })
      .filter((b) => b.getAttribute('aria-controls')?.startsWith('group-'))
    const opens = within(inv)
      .queryAllByRole('button', { expanded: true })
      .filter((b) => b.getAttribute('aria-controls')?.startsWith('group-'))
    // Every collapsible group is one or the other, and only the first starts open.
    expect(opens.length).toBeLessThanOrEqual(1)
    const first = opens[0] ?? toggles[0]
    if (!first) return
    const wasOpen = first.getAttribute('aria-expanded') === 'true'
    await user.click(first)
    expect(first).toHaveAttribute('aria-expanded', String(!wasOpen))
    const body = document.getElementById(first.getAttribute('aria-controls') as string)
    expect(body?.getAttribute('data-state')).toBe(wasOpen ? 'closed' : 'open')
  })

  it('has one combined pie of the five groups, and none inside any section', async () => {
    renderApp('/s/s-1/assets')
    const hero = await screen.findByRole('region', { name: 'Net worth' })
    const mix = await within(hero).findByTestId('asset-mix')
    const legend = within(mix).getByRole('list', {
      name: 'Share of gross total by asset group legend',
    })
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      expect.stringContaining('Cash'),
      expect.stringContaining('Investments'),
      expect.stringContaining('Fixed assets'),
      expect.stringContaining('Money owed to you'),
      expect.stringContaining('Debt'),
    ])
    expect(screen.getAllByTestId('pie-chart')).toHaveLength(1)
    expect(screen.queryByTestId('section-pie')).not.toBeInTheDocument()
    for (const name of ['Cash', 'Fixed assets', 'Debt', 'Investments', 'Money owed to you'])
      expect(
        within(screen.getByRole('region', { name })).queryByTestId('pie-chart'),
      ).not.toBeInTheDocument()
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
