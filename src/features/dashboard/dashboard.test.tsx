// biome-ignore-all lint/plugin: fixtures only
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { BASE, errorEnvelope, makeAuthedHandlers } from '../../../test/msw/api'
import { analytics, breakdown, calendar, overview } from '../../../test/msw/dashboard'
import { server } from '../../../test/msw/server'
import { renderApp } from '../../../test/renderApp'
import { monthOf, shiftMonth, validateHomeSearch } from './search'

const D = `${BASE}/spaces/s-1/dashboard`
const NW = `${BASE}/spaces/s-1/net-worth`
const thisMonth = monthOf(new Date())
const today = new Date()
const todayIso = `${thisMonth}-${String(today.getDate()).padStart(2, '0')}`

function install(over: Record<string, unknown> = {}) {
  server.use(
    http.get(`${D}/overview`, () => HttpResponse.json((over.overview as object) ?? overview())),
    http.get(`${D}/category-breakdown`, () =>
      HttpResponse.json((over.breakdown as object) ?? breakdown()),
    ),
    http.get(`${D}/analytics`, () => HttpResponse.json((over.analytics as object) ?? analytics())),
    http.get(`${D}/calendar`, ({ request }) =>
      HttpResponse.json(
        calendar(
          new URL(request.url).searchParams.get('month') ?? thisMonth,
          (over.days as never) ?? {},
        ),
      ),
    ),
    http.get(`${NW}/summary`, () =>
      HttpResponse.json({
        currency: 'IDR',
        netWorth: '95000000',
        cash: '30000000',
        trackingMode: 'FULL_NET_WORTH',
        warnings: [],
      }),
    ),
    http.get(`${NW}/history`, ({ request }) =>
      HttpResponse.json(
        (over.history as object) ?? {
          currency: 'IDR',
          range: new URL(request.url).searchParams.get('range'),
          changePct: '3.25',
          points: [
            { date: '2026-11-01', netWorth: '90000000' },
            { date: '2026-11-19', netWorth: '95000000', live: true },
          ],
        },
      ),
    ),
  )
}

beforeEach(() => server.use(...makeAuthedHandlers()))

describe('home search params', () => {
  it('keeps only valid values and never writes the defaults', () => {
    expect(validateHomeSearch({})).toEqual({})
    expect(validateHomeSearch({ month: '2026-11', range: '3M', period: 'TODAY' })).toEqual({
      month: '2026-11',
      range: '3M',
      period: 'TODAY',
    })
    expect(validateHomeSearch({ range: '1M' })).toEqual({})
    expect(validateHomeSearch({ month: '2026-13', range: '5Y', period: 'NOPE' })).toEqual({})
  })
  it('shifts months across year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-11', 0)).toBe('2026-11')
    expect(shiftMonth('2026-03', -14)).toBe('2025-01')
  })
})

describe('overview', () => {
  it('shows period expenses and income with the change against the previous period', async () => {
    install()
    renderApp('/s/s-1')
    const o = await screen.findByTestId('overview')
    expect(o).toHaveTextContent('IDR 1,250,000')
    expect(o).toHaveTextContent('IDR 5,000,000')
    expect(screen.getByTestId('expense-change')).toHaveTextContent('-5.50% vs previous')
    expect(screen.getByTestId('income-change')).toHaveTextContent('+10.00% vs previous')
  })

  it('a null previous value shows a dash, never 0%', async () => {
    install({
      overview: overview({
        change: { incomePct: undefined, expensePct: undefined, netPct: undefined },
      }),
    })
    renderApp('/s/s-1')
    const income = await screen.findByTestId('income-change')
    expect(income).toHaveTextContent('—')
    expect(income).not.toHaveTextContent('0%')
    expect(within(income).getByText('No previous data to compare')).toBeInTheDocument()
  })

  it('has an error state with a retry', async () => {
    let fail = true
    install()
    server.use(
      http.get(`${D}/overview`, () =>
        fail
          ? HttpResponse.json(errorEnvelope('INTERNAL_ERROR'), { status: 500 })
          : HttpResponse.json(overview()),
      ),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1')
    expect(await screen.findByText("Couldn't load your overview")).toBeInTheDocument()
    fail = false
    await user.click(screen.getAllByRole('button', { name: 'Try again' })[0] as HTMLElement)
    expect(await screen.findByTestId('overview')).toBeInTheDocument()
  })

  it('the period lives in the URL and is sent to every period-aware card', async () => {
    const periods: Array<string | null> = []
    install()
    server.use(
      http.get(`${D}/overview`, ({ request }) => {
        periods.push(new URL(request.url).searchParams.get('period'))
        return HttpResponse.json(overview())
      }),
    )
    const user = userEvent.setup()
    const { router } = renderApp('/s/s-1')
    await user.click(await screen.findByRole('button', { name: /This period/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Period' })
    await user.click(within(sheet).getByRole('button', { name: 'Last 7 days' }))
    await waitFor(() => expect(periods).toContain('LAST_7_DAYS'))
    expect(router.state.location.search).toMatchObject({ period: 'LAST_7_DAYS' })
  })
})

describe('net worth chart', () => {
  it('draws the line with the live point marked, and the change badge', async () => {
    install()
    renderApp('/s/s-1')
    const chart = await screen.findByTestId('line-chart')
    expect(chart.querySelector('[data-live]')).toBeInTheDocument()
    expect(within(chart).getByText('Today')).toBeInTheDocument()
    expect(await screen.findByTestId('nw-change')).toHaveTextContent('+3.25%')
  })

  it('range tabs fetch that range and live in the URL', async () => {
    const ranges: Array<string | null> = []
    install()
    server.use(
      http.get(`${NW}/history`, ({ request }) => {
        ranges.push(new URL(request.url).searchParams.get('range'))
        return HttpResponse.json({
          currency: 'IDR',
          changePct: '-2.5',
          points: [
            { date: '2026-08-01', netWorth: '1' },
            { date: '2026-11-19', netWorth: '2', live: true },
          ],
        })
      }),
    )
    const user = userEvent.setup()
    const { router } = renderApp('/s/s-1')
    await user.click(await screen.findByRole('radio', { name: '6M' }))
    await waitFor(() => expect(ranges).toContain('6M'))
    expect(router.state.location.search).toMatchObject({ range: '6M' })
    expect(await screen.findByTestId('nw-change')).toHaveClass('text-negative')
  })

  it('a space with one day of data renders a sensible single-point chart, not an empty box', async () => {
    install({
      history: {
        currency: 'IDR',
        changePct: undefined,
        points: [{ date: '2026-11-19', netWorth: '95000000', live: true }],
      },
    })
    renderApp('/s/s-1')
    const chart = await screen.findByTestId('line-chart')
    expect(chart.querySelectorAll('circle').length).toBeGreaterThan(0)
    expect(chart.querySelector('path.stroke-accent')).not.toBeInTheDocument() // no line to draw
    expect(within(chart).queryByText(/No data/)).not.toBeInTheDocument()
  })

  it('shows an empty-data message when there are no points at all', async () => {
    install({ history: { currency: 'IDR', points: [] } })
    renderApp('/s/s-1')
    expect(await screen.findByText('No data for this period.')).toBeInTheDocument()
  })

  it('offers a text table for screen readers', async () => {
    install()
    renderApp('/s/s-1')
    const chart = await screen.findByTestId('line-chart')
    const table = chart.querySelector('table.sr-only') as HTMLElement
    expect(table).toBeInTheDocument()
    expect(within(table).getAllByRole('row')).toHaveLength(3) // header + 2 points
    expect(table).toHaveTextContent('IDR 95,000,000')
  })
})

describe('category breakdown', () => {
  it('draws a donut with the transaction count in the middle, a legend, and an uncategorised slice', async () => {
    install()
    renderApp('/s/s-1')
    const donut = await screen.findByTestId('donut-chart')
    expect(within(donut).getByText('14')).toBeInTheDocument() // 8 + 4 + 2
    expect(within(donut).getByText('transactions')).toBeInTheDocument()
    expect(within(donut).getByRole('button', { name: /Food/ })).toHaveTextContent('60.00%')
    expect(within(donut).getAllByText('Uncategorised').length).toBeGreaterThan(0) // legend + screen-reader table
    expect(donut.querySelectorAll('path[data-slice]')).toHaveLength(3)
  })

  it('tapping a category goes to history filtered by it, keeping the period', async () => {
    install()
    const user = userEvent.setup()
    const { router } = renderApp('/s/s-1?period=LAST_30_DAYS')
    await user.click(await screen.findByRole('button', { name: /Food/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/s/s-1/history'))
    expect(router.state.location.search).toMatchObject({
      categoryIds: ['e-0'],
      period: 'LAST_30_DAYS',
    })
  })

  it('uncategorised is shown but not tappable', async () => {
    install()
    renderApp('/s/s-1')
    const donut = await screen.findByTestId('donut-chart')
    const legend = donut.querySelector('ul') as HTMLElement
    const row = within(legend).getByText('Uncategorised').closest('li') as HTMLElement
    expect(within(row).queryByRole('button')).not.toBeInTheDocument()
  })

  it('switches to income and requests that type', async () => {
    const types: Array<string | null> = []
    install()
    server.use(
      http.get(`${D}/category-breakdown`, ({ request }) => {
        types.push(new URL(request.url).searchParams.get('type'))
        return HttpResponse.json(
          breakdown({
            type: 'INCOME',
            items: [
              {
                categoryId: 'i-0',
                name: 'Salary',
                icon: '💰',
                amount: '5000000',
                pct: '100.00',
                count: 1,
              },
            ],
            uncategorized: undefined,
          }),
        )
      }),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1')
    await user.click(await screen.findByRole('radio', { name: 'Income' }))
    expect(await screen.findByRole('button', { name: /Salary/ })).toBeInTheDocument()
    expect(types).toContain('INCOME')
  })

  it('shows an empty-data state', async () => {
    install({ breakdown: breakdown({ items: [], uncategorized: undefined, total: '0' }) })
    renderApp('/s/s-1')
    expect(await screen.findByText('Nothing to show for this period.')).toBeInTheDocument()
  })
})

describe('analytics', () => {
  it('draws income and expense bars per bucket, labelled exactly as the server sent them', async () => {
    install()
    renderApp('/s/s-1')
    const chart = await screen.findByTestId('bar-chart')
    for (const label of ['1–7 Nov', '8–14 Nov', '15–21 Nov', '22–28 Nov', '29–30 Nov']) {
      expect(within(chart).getAllByText(label).length).toBeGreaterThan(0)
    }
    expect(chart.querySelectorAll('rect[data-kind="income"]')).toHaveLength(5)
    expect(chart.querySelectorAll('rect[data-kind="expense"]')).toHaveLength(5)
    // colour is never the only cue: the legend names both series
    const legend = chart.querySelector('ul') as HTMLElement
    expect(within(legend).getByText('Income')).toBeInTheDocument()
    expect(within(legend).getByText('Expense')).toBeInTheDocument()
  })

  it('shows the comparison lines (server totals and changes) below the chart', async () => {
    install()
    renderApp('/s/s-1')
    const lines = await screen.findByTestId('comparison')
    expect(lines).toHaveTextContent('Income')
    expect(lines).toHaveTextContent('IDR 5,000,000')
    expect(lines).toHaveTextContent('+10.00%')
    expect(lines).toHaveTextContent('-5.50%')
    expect(lines).toHaveTextContent('+IDR 3,750,000') // net
  })

  it('shows an empty-data state when nothing was spent or earned', async () => {
    install({
      analytics: analytics({ buckets: [{ label: '1–7 Nov', income: '0', expense: '0' }] }),
    })
    renderApp('/s/s-1')
    expect(await screen.findByText('No income or expenses in this period.')).toBeInTheDocument()
  })
})

describe('calendar', () => {
  it('lists every day of the month, highlights today, and marks days with activity', async () => {
    install({
      days: {
        [`${thisMonth}-05`]: { count: 3, income: '100000', expense: '40000', net: '60000' },
        [todayIso]: { count: 1 },
      },
    })
    renderApp('/s/s-1')
    const list = await screen.findByRole('list', { name: /Activity in/ })
    const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    expect(within(list).getAllByRole('link')).toHaveLength(days)
    expect(within(list).getByRole('link', { current: 'date' })).toBeInTheDocument()
    expect(within(list).getAllByTestId('count-dot').length).toBeGreaterThanOrEqual(1)
    expect(within(list).getByText('+IDR 60K')).toBeInTheDocument() // compact per-day net
  })

  it('arrows move between months, the month lives in the URL, and the grid is re-requested', async () => {
    const months: string[] = []
    install()
    server.use(
      http.get(`${D}/calendar`, ({ request }) => {
        const m = new URL(request.url).searchParams.get('month') as string
        months.push(m)
        return HttpResponse.json(calendar(m))
      }),
    )
    const user = userEvent.setup()
    const { router } = renderApp('/s/s-1')
    await user.click(await screen.findByRole('button', { name: 'Previous month' }))
    const prev = shiftMonth(thisMonth, -1)
    await waitFor(() => expect(months).toContain(prev))
    expect(router.state.location.search).toMatchObject({ month: prev })
    await user.click(screen.getByRole('button', { name: 'Next month' }))
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('month')) // back to the default
  })

  it('a day links to history for just that day', async () => {
    install()
    const user = userEvent.setup()
    const { router } = renderApp('/s/s-1')
    const list = await screen.findByRole('list', { name: /Activity in/ })
    await user.click(within(list).getAllByRole('link')[4] as HTMLElement)
    await waitFor(() => expect(router.state.location.pathname).toBe('/s/s-1/history'))
    expect(router.state.location.search).toMatchObject({
      from: `${thisMonth}-05`,
      to: `${thisMonth}-05`,
    })
  })

  it('has an error state with a retry', async () => {
    install()
    server.use(
      http.get(`${D}/calendar`, () =>
        HttpResponse.json(errorEnvelope('INTERNAL_ERROR'), { status: 500 }),
      ),
    )
    renderApp('/s/s-1')
    expect(await screen.findByText("Couldn't load the calendar")).toBeInTheDocument()
  })
})

describe('quick actions', () => {
  it('only Goals is wired; Import, Insight and Consult are absent rather than disabled', async () => {
    install()
    renderApp('/s/s-1')
    const nav = await screen.findByRole('navigation', { name: 'Quick actions' })
    expect(within(nav).getAllByRole('link')).toHaveLength(1)
    expect(within(nav).getByRole('link', { name: 'Goals' })).toBeInTheDocument()
    for (const name of [/Import/, /Insight/, /Consult/])
      expect(screen.queryByText(name)).not.toBeInTheDocument()
  })
})

describe('hide amounts', () => {
  it('no money string appears anywhere on the dashboard when amounts are hidden', async () => {
    install()
    server.use(
      ...makeAuthedHandlers({
        preferences: { hideAmounts: true, keyboardType: 'MINI_CALCULATOR', appLockEnabled: false },
      }),
    )
    renderApp('/s/s-1')
    await screen.findByTestId('overview')
    await screen.findByTestId('donut-chart')
    const body = document.body.innerHTML
    expect(body).not.toMatch(/IDR\s*1,250,000/)
    expect(body).not.toMatch(/95,000,000/)
    expect(body).not.toMatch(/750,000/)
  })
})
