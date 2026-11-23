// biome-ignore-all lint/plugin: fixtures only
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { BASE, makeAuthedHandlers } from '../../../test/msw/api'
import { assetList, summary } from '../../../test/msw/assets'
import { list, metas } from '../../../test/msw/investments'
import { server } from '../../../test/msw/server'
import { bank, cash, walletList } from '../../../test/msw/wallets'
import { renderApp } from '../../../test/renderApp'
import { directionSentence, seriesPoints, trendFromDirection } from './growth'

const NW = `${BASE}/spaces/s-1/net-worth`

const verdict = (over: Record<string, unknown> = {}) => ({
  first: '100',
  last: '120',
  change: '20',
  changePct: '20.00',
  performancePct: '5.00',
  netContributions: '0',
  direction: 'RISING',
  ...over,
})

const history = (over: Record<string, unknown> = {}) => ({
  currency: 'IDR',
  range: '1M',
  changePct: '20.00',
  points: [
    { date: '2026-11-01', netWorth: '100', investments: '10', fixedAssets: '5', assets: '150' },
    { date: '2026-11-20', netWorth: '120', investments: '8', fixedAssets: '5', assets: '160' },
  ],
  series: {
    netWorth: verdict(),
    investments: verdict({
      first: '10',
      last: '8',
      change: '-2',
      changePct: '-20.00',
      direction: 'FALLING',
    }),
    fixedAssets: verdict({
      direction: 'FLAT',
      change: '0',
      changePct: '0.00',
      performancePct: null,
    }),
    assets: verdict({ netContributions: '30' }),
  },
  ...over,
})

describe('growth helpers (F39)', () => {
  it('picks the points of one series', () => {
    const h = history() as never
    expect(seriesPoints(h, 'investments').map((p) => p.value)).toEqual(['10', '8'])
    expect(seriesPoints(undefined, 'netWorth')).toEqual([])
  })
  it('maps the server direction to a colour, and nothing without a verdict', () => {
    expect(trendFromDirection('RISING')).toBe('up')
    expect(trendFromDirection('FALLING')).toBe('down')
    expect(trendFromDirection('FLAT')).toBe('flat')
    expect(trendFromDirection(null)).toBeUndefined()
  })
  it('writes the verdict as a sentence', () => {
    expect(directionSentence('RISING', '3M')).toBe('Rising over the last 3 months')
    expect(directionSentence('FALLING', '1M')).toBe('Falling over the last month')
    expect(directionSentence('FLAT', '1M')).toBe('Flat')
    expect(directionSentence('RISING', 'YTD')).toBe('Rising over this year so far')
    expect(directionSentence(null, '1M')).toBeNull()
  })
})

describe('growth chart on the Assets page', () => {
  const requests: string[] = []
  const install = (body: (range: string) => object) => {
    requests.length = 0
    server.use(...makeAuthedHandlers())
    server.use(
      http.get(`${BASE}/investment-types`, () => HttpResponse.json(metas)),
      http.get(`${BASE}/spaces/s-1/wallets`, () => HttpResponse.json(walletList([cash, bank]))),
      http.get(`${BASE}/spaces/s-1/investments`, () => HttpResponse.json(list([]))),
      http.get(`${NW}/summary`, () => HttpResponse.json(summary())),
      http.get(`${BASE}/spaces/s-1/manual-assets`, ({ request }) => {
        const kind = new URL(request.url).searchParams.get('kind') as 'FIXED_ASSET'
        return HttpResponse.json(assetList(kind, [], '0'))
      }),
      http.get(`${NW}/history`, ({ request }) => {
        const range = new URL(request.url).searchParams.get('range') ?? ''
        requests.push(range)
        return HttpResponse.json(body(range))
      }),
    )
  }

  it('starts on net worth for 1M, shows the server figures and the rising sentence', async () => {
    install(() => history())
    renderApp('/s/s-1/assets')
    expect(await screen.findByTestId('growth-change')).toHaveTextContent('+IDR 20 (+20.00%)')
    expect(screen.getByTestId('growth-performance')).toHaveTextContent(
      'Return, excl. deposits: +5.00%',
    )
    expect(screen.getByTestId('growth-sentence')).toHaveTextContent('Rising over the last month')
    expect(screen.getByRole('radio', { name: 'Net worth' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '1M' })).toBeChecked()
    const chart = screen.getByTestId('line-chart')
    expect(chart.querySelector('svg')).toHaveAttribute('data-trend', 'up')
  })

  it('switching the series does not refetch, and the line follows the new verdict', async () => {
    const user = userEvent.setup()
    install(() => history())
    renderApp('/s/s-1/assets')
    await screen.findByTestId('growth-change')
    const before = requests.length
    await user.click(screen.getByRole('radio', { name: 'Investments' }))
    expect(screen.getByTestId('growth-sentence')).toHaveTextContent('Falling over the last month')
    expect(screen.getByTestId('line-chart').querySelector('svg')).toHaveAttribute(
      'data-trend',
      'down',
    )
    await user.click(screen.getByRole('radio', { name: 'Fixed assets' }))
    expect(screen.getByTestId('growth-sentence')).toHaveTextContent('Flat')
    expect(screen.getByTestId('growth-performance')).toHaveTextContent('Return, excl. deposits: —')
    expect(requests.length).toBe(before)
  })

  it('a new range refetches with that range', async () => {
    const user = userEvent.setup()
    install((range) => history({ range }))
    renderApp('/s/s-1/assets')
    await screen.findByTestId('growth-change')
    await user.click(screen.getByRole('radio', { name: 'YTD' }))
    await waitFor(() => expect(requests).toContain('YTD'))
    await user.click(screen.getByRole('radio', { name: '1W' }))
    await waitFor(() => expect(requests).toContain('1W'))
  })

  it('notes money put in by the user, only when it is not zero, and the short coverage', async () => {
    const user = userEvent.setup()
    install(() =>
      history({
        coverage: { firstPointDate: '2026-11-01', requestedFrom: '2026-08-01', short: true },
      }),
    )
    renderApp('/s/s-1/assets')
    await screen.findByTestId('growth-change')
    expect(screen.queryByTestId('growth-contributions')).not.toBeInTheDocument() // net worth: 0 put in
    expect(screen.getByTestId('growth-coverage')).toHaveTextContent('Your data only covers')
    await user.click(screen.getByRole('radio', { name: 'All assets' }))
    expect(screen.getByTestId('growth-contributions')).toHaveTextContent(
      'IDR 30 of your money in this range was added by you.',
    )
  })

  it('shows a dash for hidden numbers, and "History starts today" for one point', async () => {
    install(() =>
      history({
        points: [
          { date: '2026-11-20', netWorth: '1', investments: '1', fixedAssets: '1', assets: '1' },
        ],
        series: {
          netWorth: verdict({
            last: null,
            change: null,
            changePct: null,
            performancePct: null,
            direction: null,
          }),
        },
      }),
    )
    renderApp('/s/s-1/assets')
    const summaryBox = await screen.findByTestId('growth-summary')
    expect(within(summaryBox).getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.getByText('History starts today.')).toBeInTheDocument()
    expect(screen.queryByTestId('growth-sentence')).not.toBeInTheDocument()
  })
})
