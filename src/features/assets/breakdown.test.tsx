// biome-ignore-all lint/plugin: fixtures only
import { screen, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { BASE, makeAuthedHandlers } from '../../../test/msw/api'
import { assetList, debt, house, owed, summary } from '../../../test/msw/assets'
import { btc, list, metas, sharedIn, valuation } from '../../../test/msw/investments'
import { server } from '../../../test/msw/server'
import { bank, cash, walletList } from '../../../test/msw/wallets'
import { renderApp } from '../../../test/renderApp'

const NW = `${BASE}/spaces/s-1/net-worth`

beforeEach(() => {
  server.use(...makeAuthedHandlers())
  server.use(
    http.get(`${BASE}/investment-types`, () => HttpResponse.json(metas)),
    http.get(`${BASE}/spaces/s-1/wallets`, () => HttpResponse.json(walletList([cash, bank]))),
    http.get(`${BASE}/spaces/s-1/investments`, () =>
      HttpResponse.json(
        list([
          {
            ...btc,
            valuation: valuation({
              base: {
                currency: 'IDR',
                marketValue: '10400000',
                costBasis: '8000000',
                unrealizedPl: '2400000',
                fxRate: '16000',
              },
              unrealizedPlPct: '30',
            }),
          },
        ]),
      ),
    ),
    http.get(`${NW}/summary`, () => HttpResponse.json(summary())),
    http.get(`${NW}/history`, () =>
      HttpResponse.json({ currency: 'IDR', changePct: '1', range: '1M', points: [] }),
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

describe('assets page breakdown (S6)', () => {
  it('lists wallets by type, investments by category with PnL, and every manual kind', async () => {
    renderApp('/s/s-1/assets')
    const cashSection = await screen.findByRole('region', { name: 'Cash' })
    expect(await within(cashSection).findByText('BCA')).toBeInTheDocument()
    expect(within(cashSection).getByRole('heading', { name: 'Cash' })).toBeInTheDocument()
    expect(within(cashSection).getByRole('heading', { name: 'Bank' })).toBeInTheDocument()
    expect(within(cashSection).getByRole('link', { name: /Cash/ })).toBeInTheDocument()
    expect(within(cashSection).getByText('IDR 1,500,000')).toBeInTheDocument()

    const inv = screen.getByRole('region', { name: 'Investments' })
    expect(await within(inv).findByText('Bitcoin')).toBeInTheDocument()
    expect(within(inv).getByRole('heading', { name: 'Crypto' })).toBeInTheDocument()
    const pl = within(inv).getByTestId('row-pl')
    expect(pl).toHaveTextContent('+IDR 2,400,000')
    expect(pl).toHaveTextContent('(30%)')
    expect(within(pl).getByText('+IDR 2,400,000')).toHaveClass('text-positive')

    expect(await screen.findByText('Apartment')).toBeInTheDocument()
    expect(screen.getByText('Car loan')).toBeInTheDocument()
    for (const name of ['Fixed assets', 'Money owed to you', 'Debt'])
      expect(screen.getByRole('region', { name })).toBeInTheDocument()
  })
})

describe('shared investment access (S6)', () => {
  it('a shared-in investment opens without a "not found" or access error', async () => {
    server.use(http.get(`${BASE}/spaces/s-1/investments/i-3`, () => HttpResponse.json(sharedIn)))
    renderApp('/s/s-1/investments/i-3')
    expect(await screen.findByText('Family ETF')).toBeInTheDocument()
    expect(screen.queryByText('You no longer have access')).not.toBeInTheDocument()
    expect(screen.queryByText("Couldn't load this investment")).not.toBeInTheDocument()
    expect(await screen.findByTestId('share-compare')).toHaveTextContent('My share (25.00%)')
  })
})
