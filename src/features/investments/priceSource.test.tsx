// biome-ignore-all lint/plugin: fixtures only
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { BASE, makeAuthedHandlers } from '../../../test/msw/api'
import { bbca, btc, list, metas, valuation } from '../../../test/msw/investments'
import { server } from '../../../test/msw/server'
import { bank, cash, walletList } from '../../../test/msw/wallets'
import { renderApp } from '../../../test/renderApp'
import {
  PriceSourceBadge,
  priceSourceLabel,
  priceSourceShort,
  typedPriceCount,
} from './priceSource'
import { parseValuation } from './valuation'

const I = `${BASE}/spaces/s-1/investments`
const now = new Date('2026-11-23T10:02:00Z')

describe('price source text (F34-T01)', () => {
  it('names each source', () => {
    expect(
      priceSourceLabel({ priceSource: 'MARKET', priceAsOf: '2026-11-23T10:00:00Z' }, now),
    ).toBe('Live price · 2 minutes ago')
    expect(priceSourceLabel({ priceSource: 'MARKET', priceAsOf: null }, now)).toBe('Live price')
    expect(
      priceSourceLabel({ priceSource: 'MARKET', priceAsOf: '2026-11-23T10:01:40Z' }, now),
    ).toBe('Live price · just now')
    expect(priceSourceLabel({ priceSource: 'MANUAL', priceAsOf: null })).toBe('Typed price')
    expect(priceSourceLabel({ priceSource: 'MANUAL_VALUE', priceAsOf: null })).toBe('Manual value')
  })
  it('the short form adds the old-price note', () => {
    expect(priceSourceShort({ priceSource: 'MARKET', isStale: true })).toBe(
      'Live price · price is old',
    )
    expect(priceSourceShort({ priceSource: 'MANUAL', isStale: false })).toBe('Typed price')
  })
  it('the badge shows a warning with "Price is old" only when stale', () => {
    const live = parseValuation(valuation()) as never
    const { rerender } = render(<PriceSourceBadge valuation={live} assetType="CRYPTO" />)
    expect(screen.getByTestId('price-source')).toHaveAttribute('title', 'Source: CoinMarketCap')
    expect(screen.queryByText('Price is old')).not.toBeInTheDocument()
    rerender(<PriceSourceBadge valuation={parseValuation(valuation({ isStale: true })) as never} />)
    expect(screen.getByText('Price is old')).toBeInTheDocument()
  })
  it('counts holdings not priced by the market, from the list', () => {
    const live = { ...btc, valuation: valuation() }
    const typed = { ...bbca, valuation: valuation({ priceSource: 'MANUAL' }) }
    expect(typedPriceCount([live, typed, typed])).toEqual({ typed: 2, total: 3 })
    expect(typedPriceCount([live])).toEqual({ typed: 0, total: 1 })
  })
})

describe('price source on screens', () => {
  beforeEach(() =>
    server.use(
      ...makeAuthedHandlers(),
      http.get(`${BASE}/investment-types`, () => HttpResponse.json(metas)),
      http.get(`${BASE}/spaces/s-1/wallets`, () => HttpResponse.json(walletList([cash, bank]))),
    ),
  )

  it('the Investments page notes how many holdings use a typed price, and hides it when all are live', async () => {
    server.use(
      http.get(I, () =>
        HttpResponse.json(
          list([btc, { ...bbca, valuation: valuation({ priceSource: 'MANUAL' }) }]),
        ),
      ),
    )
    const { unmount } = renderApp('/s/s-1/investments')
    expect(await screen.findByTestId('typed-price-note')).toHaveTextContent(
      '1 of 2 holdings use a typed price',
    )
    unmount()
    server.use(http.get(I, () => HttpResponse.json(list([btc]))))
    renderApp('/s/s-1/investments')
    await screen.findByTestId('portfolio-summary')
    expect(screen.queryByTestId('typed-price-note')).not.toBeInTheDocument()
  })

  it('a manual value that overrides the live price says so, and "Use live price" clears it', async () => {
    let body: Record<string, unknown> | null = null
    server.use(
      http.get(`${I}/i-1`, () =>
        HttpResponse.json({
          ...btc,
          valuation: valuation({
            priceSource: 'MANUAL_VALUE',
            warnings: [
              { code: 'MANUAL_VALUE_OVERRIDES_MARKET', message: 'A manual value overrides it' },
            ],
          }),
        }),
      ),
      http.patch(`${I}/i-1`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(btc)
      }),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/investments/i-1')
    const warn = await screen.findByTestId('override-warning')
    expect(warn).toHaveTextContent('Manual value is used instead of the live price')
    expect(screen.getAllByText('Manual value').length).toBeGreaterThan(0)
    await user.click(within(warn).getByRole('button', { name: 'Use live price' }))
    await waitFor(() => expect(body).toEqual({ manualCurrentValue: null }))
  })
})
