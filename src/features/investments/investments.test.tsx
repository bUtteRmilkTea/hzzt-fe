// biome-ignore-all lint/plugin: fixtures only
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import {
  BASE,
  errorEnvelope,
  makeAuthedHandlers,
  ownerSpace,
  sharedSpace,
} from '../../../test/msw/api'
import { bbca, btc, list, metas, sharedIn, valuation } from '../../../test/msw/investments'
import { server } from '../../../test/msw/server'
import { bank, cash, walletList } from '../../../test/msw/wallets'
import { renderApp } from '../../../test/renderApp'

const I = `${BASE}/spaces/s-1/investments`
const w1 = { ...cash, sortOrder: 0 }
const w2 = { ...bank, sortOrder: 1 }

beforeEach(() => {
  server.use(...makeAuthedHandlers())
  server.use(
    http.get(`${BASE}/investment-types`, () => HttpResponse.json(metas)),
    http.get(`${BASE}/spaces/s-1/wallets`, () => HttpResponse.json(walletList([w1, w2]))),
    http.get(`${BASE}/fx/latest`, () =>
      HttpResponse.json({ base: 'USD', asOf: '2026-11-23', rates: { IDR: '16250.5' } }),
    ),
  )
})

describe('portfolio list', () => {
  it('groups by asset type, shows the server totals, and colours P/L by sign', async () => {
    server.use(
      http.get(I, ({ request }) => {
        expect(new URL(request.url).searchParams.get('include')).toBe('shared')
        return HttpResponse.json(
          list([
            {
              ...bbca,
              valuation: valuation({
                unrealizedPl: '-100000',
                unrealizedPlPct: '-5.5',
                marketValue: '1700000',
                costBasis: '1800000',
                base: null,
              }),
            },
            btc,
          ]),
        )
      }),
    )
    renderApp('/s/s-1/investments')
    const summary = await screen.findByTestId('portfolio-summary')
    expect(summary).toHaveTextContent('IDR 12,300,000') // from the server, not recomputed
    expect(summary).toHaveTextContent('+IDR 2,500,000')
    expect(summary).toHaveTextContent('(25.51%)')

    const crypto = screen.getByRole('region', { name: 'Crypto' })
    const stocks = screen.getByRole('region', { name: 'Indonesian stock' })
    expect(within(crypto).getByText('Bitcoin')).toBeInTheDocument()
    expect(within(stocks).getByText('BCA')).toBeInTheDocument()
    expect(within(crypto).getByText('+IDR 2,400,000')).toHaveClass('text-positive')
    expect(within(stocks).getByText('-IDR 100,000')).toHaveClass('text-negative')
    expect(within(crypto).getAllByText('IDR 10,400,000').length).toBeGreaterThan(0) // converted value
  })

  it('shows the portfolio warnings for assets without a rate', async () => {
    server.use(
      http.get(I, () =>
        HttpResponse.json(
          list([btc], {
            warnings: [
              {
                code: 'FX_RATE_UNAVAILABLE',
                message: 'No USD to IDR rate: Bitcoin is left out of the total',
              },
            ],
          }),
        ),
      ),
    )
    renderApp('/s/s-1/investments')
    expect(await screen.findByText(/Bitcoin is left out of the total/)).toBeInTheDocument()
  })

  it('a provider outage shows the last known price with a stale badge, not an error', async () => {
    server.use(
      http.get(I, () =>
        HttpResponse.json(
          list([
            { ...btc, valuation: valuation({ isStale: true, priceAsOf: '2026-11-18T08:30:00Z' }) },
          ]),
        ),
      ),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/investments')
    const crypto = await screen.findByRole('region', { name: 'Crypto' })
    expect(within(crypto).getAllByText('Bitcoin').length).toBeGreaterThan(0)
    expect(within(crypto).getAllByText('IDR 10,400,000').length).toBeGreaterThan(0) // the last known value is still shown
    const badge = screen.getByRole('button', { name: 'Price is old' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(badge).toHaveAttribute('title', expect.stringContaining('Price as of'))
    await user.click(badge)
    expect(screen.getByText(/Last price .* ago, retrying \(as of 18 Nov 2026/)).toBeInTheDocument()
  })

  it('marks shared-in investments with the share', async () => {
    server.use(http.get(I, () => HttpResponse.json(list([sharedIn]))))
    renderApp('/s/s-1/investments')
    expect(await screen.findByText('Shared · 25.00%')).toBeInTheDocument()
  })

  it('has empty, error-with-retry and loading states', async () => {
    let mode: 'error' | 'empty' = 'error'
    server.use(
      http.get(I, async () => {
        await new Promise((r) => setTimeout(r, 40))
        return mode === 'error'
          ? HttpResponse.json(errorEnvelope('INTERNAL_ERROR'), { status: 500 })
          : HttpResponse.json(list([]))
      }),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/investments')
    await screen.findByRole('heading', { name: 'Investments' })
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument()
    expect(await screen.findByText("Couldn't load your investments")).toBeInTheDocument()
    mode = 'empty'
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('No investments yet')).toBeInTheDocument()
  })
})

describe('create investment', () => {
  const open = async (user: ReturnType<typeof userEvent.setup>, type?: string) => {
    renderApp('/s/s-1/investments/new')
    const select = await screen.findByLabelText('Type')
    if (type)
      await user.selectOptions(select, metas.find((m) => m.label === type)?.assetType as string)
  }

  it('offers exactly the types the backend lists', async () => {
    renderApp('/s/s-1/investments/new')
    const select = await screen.findByLabelText('Type')
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(metas.map((m) => `${m.defaultIcon} ${m.label}`))
  })

  it('2 lots of an Indonesian stock shows 200 shares, derived and read-only, and sends no quantity', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post(I, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ ...bbca, id: 'i-new' }, { status: 201 })
      }),
      http.get(`${I}/i-new`, () => HttpResponse.json(bbca)),
    )
    const user = userEvent.setup()
    await open(user, 'Indonesian stock')
    expect(screen.queryByLabelText('Quantity')).not.toBeInTheDocument() // there is no quantity field to type into
    await user.type(screen.getByLabelText('Lots'), '2')
    expect(screen.getByTestId('derived-shares')).toHaveTextContent('= 200 shares')
    await user.type(screen.getByLabelText('Name'), 'Bank Central Asia')
    await user.type(screen.getByLabelText('Symbol'), 'bbca')
    await user.type(screen.getByLabelText('Average buy price'), '9000')
    await user.type(screen.getByLabelText('Current price'), '9500')
    await user.click(screen.getByRole('button', { name: 'Add investment' }))
    await waitFor(() =>
      expect(body).toMatchObject({
        assetType: 'ID_STOCK',
        symbol: 'BBCA',
        details: { lots: 2 },
        priceMode: 'MANUAL',
        manualPrice: '9500',
      }),
    )
    expect(body).not.toHaveProperty('quantity')
  })

  it('disables the Auto tab for types without auto pricing, with a short reason', async () => {
    const user = userEvent.setup()
    await open(user, 'Indonesian stock')
    expect(screen.getByRole('radio', { name: 'Auto' })).toBeDisabled()
    expect(
      screen.getByText(/Automatic pricing isn't available for indonesian stock/),
    ).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Type'), 'MUTUAL_FUND')
    expect(screen.getByRole('radio', { name: 'Auto' })).toBeDisabled()
    await user.selectOptions(screen.getByLabelText('Type'), 'CRYPTO')
    expect(screen.getByRole('radio', { name: 'Auto' })).toBeEnabled()
  })

  it('Auto mode cannot be submitted without a resolved instrument id', async () => {
    const called = vi.fn()
    server.use(
      http.post(I, () => {
        called()
        return HttpResponse.json(btc, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    await open(user, 'Crypto')
    await user.click(screen.getByRole('radio', { name: 'Auto' }))
    await user.type(screen.getByLabelText('Name'), 'Bitcoin')
    await user.type(screen.getByLabelText('Quantity'), '0.01')
    await user.click(screen.getByRole('button', { name: 'Add investment' }))
    expect(
      await screen.findByText('Search and choose an instrument for automatic pricing.'),
    ).toBeInTheDocument()
    expect(called).not.toHaveBeenCalled()
  })

  it('searches the market (debounced), fills the form from the pick, and sends the instrument id', async () => {
    const qs: string[] = []
    let body: Record<string, unknown> = {}
    server.use(
      http.get(`${BASE}/market/crypto/search`, ({ request }) => {
        qs.push(new URL(request.url).searchParams.get('q') as string)
        return HttpResponse.json([
          { instrumentId: 'inst-btc', symbol: 'BTC', name: 'Bitcoin', rank: 1 },
        ])
      }),
      http.post(I, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ ...btc, id: 'i-new' }, { status: 201 })
      }),
      http.get(`${I}/i-new`, () => HttpResponse.json(btc)),
    )
    const user = userEvent.setup()
    await open(user, 'Crypto')
    await user.click(screen.getByRole('radio', { name: 'Auto' }))
    await user.type(screen.getByLabelText('Search coins'), 'btc')
    await user.click(await screen.findByRole('button', { name: /BTC.*Bitcoin/ }))
    expect(qs).toEqual(['btc']) // one request for the final text, not one per letter
    expect(screen.getByLabelText('Name')).toHaveValue('Bitcoin')
    expect(screen.getByLabelText('Symbol')).toHaveValue('BTC')
    await user.type(screen.getByLabelText('Quantity'), '0.01')
    await user.click(screen.getByRole('button', { name: 'Add investment' }))
    await waitFor(() =>
      expect(body).toMatchObject({
        assetType: 'CRYPTO',
        priceMode: 'AUTO',
        instrumentId: 'inst-btc',
        quantity: '0.01',
        symbol: 'BTC',
      }),
    )
    expect(body).not.toHaveProperty('manualPrice')
  })

  it('says so plainly when the search is rate limited', async () => {
    server.use(
      http.get(`${BASE}/market/stocks/search`, () =>
        HttpResponse.json(errorEnvelope('RATE_LIMITED'), { status: 429 }),
      ),
    )
    const user = userEvent.setup()
    await open(user, 'US stock')
    await user.click(screen.getByRole('radio', { name: 'Auto' }))
    await user.type(screen.getByLabelText('Search stocks'), 'aapl')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many attempts. Please wait a moment and try again.',
    )
  })

  it('requires the per-type fields: a US stock needs an exchange', async () => {
    const called = vi.fn()
    server.use(
      http.post(I, () => {
        called()
        return HttpResponse.json(btc, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    await open(user, 'US stock')
    await user.type(screen.getByLabelText('Name'), 'Apple')
    await user.type(screen.getByLabelText('Symbol'), 'AAPL')
    await user.type(screen.getByLabelText('Quantity'), '3')
    await user.click(screen.getByRole('button', { name: 'Add investment' }))
    expect(await screen.findByText('Exchange is required')).toBeInTheDocument()
    expect(called).not.toHaveBeenCalled()
    // USD is not the space currency: the provider rate is shown, and the typed rate hides behind a switch
    expect(await screen.findByTestId('fx-help')).toHaveTextContent(
      "Today's rate: 16,250.5 · FX service",
    )
    expect(screen.queryByLabelText(/Exchange rate \(1 USD = \? IDR/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('switch', { name: 'Use my own exchange rate' }))
    expect(screen.getByLabelText(/Exchange rate \(1 USD = \? IDR/)).toBeInTheDocument()
  })

  it('a mutual fund needs a fund type and lets you choose the currency', async () => {
    const user = userEvent.setup()
    await open(user, 'Mutual fund')
    expect(screen.getByLabelText('Currency')).toBeEnabled()
    await user.type(screen.getByLabelText('Name'), 'Sucorinvest')
    await user.type(screen.getByLabelText('Quantity'), '100')
    await user.click(screen.getByRole('button', { name: 'Add investment' }))
    expect(await screen.findByText('Fund type is required')).toBeInTheDocument()
    expect(screen.getByLabelText(/Symbol \(optional\)/)).toBeInTheDocument()
  })

  it('crypto has no staked quantity field and no second exchange field', async () => {
    const user = userEvent.setup()
    await open(user, 'Crypto')
    expect(screen.queryByLabelText(/Staked quantity/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Exchange or wallet/)).not.toBeInTheDocument()
    expect(screen.getAllByLabelText(/Exchange, broker or platform/)).toHaveLength(1)
  })

  it('can pay for the initial position from a wallet', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post(I, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ ...btc, id: 'i-new' }, { status: 201 })
      }),
      http.get(`${I}/i-new`, () => HttpResponse.json(btc)),
    )
    const user = userEvent.setup()
    await open(user, 'Crypto')
    await user.type(screen.getByLabelText('Name'), 'Bitcoin')
    await user.type(screen.getByLabelText('Symbol'), 'BTC')
    await user.type(screen.getByLabelText('Quantity'), '0.5')
    await user.selectOptions(screen.getByLabelText('Wallet'), 'w-2')
    await user.click(screen.getByRole('button', { name: 'Add investment' }))
    await waitFor(() => expect(body).toMatchObject({ funding: { walletId: 'w-2' } }))
  })

  it('maps server validation errors onto fields', async () => {
    server.use(
      http.post(I, () =>
        HttpResponse.json(
          errorEnvelope('VALIDATION_FAILED', '', { name: 'must be 1 to 60 characters' }),
          { status: 400 },
        ),
      ),
    )
    const user = userEvent.setup()
    await open(user, 'Crypto')
    await user.type(screen.getByLabelText('Name'), 'X')
    await user.type(screen.getByLabelText('Symbol'), 'X')
    await user.type(screen.getByLabelText('Quantity'), '1')
    await user.click(screen.getByRole('button', { name: 'Add investment' }))
    expect(await screen.findByText('must be 1 to 60 characters')).toBeInTheDocument()
  })
})

describe('investment detail', () => {
  it('shows the valuation breakdown, position, price source and realised P/L', async () => {
    server.use(http.get(`${I}/i-1`, () => HttpResponse.json(btc)))
    renderApp('/s/s-1/investments/i-1')
    const card = await screen.findByTestId('valuation')
    expect(card).toHaveTextContent('IDR 10,400,000')
    expect(card).toHaveTextContent('+IDR 2,400,000')
    expect(card).toHaveTextContent('Exchange rate16000')
    expect(screen.getByText('Market')).toBeInTheDocument()
    expect(screen.getByText('0.01')).toBeInTheDocument()
    expect(screen.getByText(/Realised P\/L \(1 sale\)/)).toBeInTheDocument()
  })

  it('refresh is offered for auto-priced investments, and a 429 starts a countdown', async () => {
    server.use(
      http.get(`${I}/i-1`, () => HttpResponse.json(btc)),
      http.post(`${I}/i-1/refresh-price`, () =>
        HttpResponse.json(errorEnvelope('RATE_LIMITED', '', { retryAfter: 42 }), { status: 429 }),
      ),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/investments/i-1')
    await user.click(await screen.findByRole('button', { name: 'Refresh price' }))
    expect(
      await screen.findByRole('button', { name: /Refresh available in 4[12]s/ }),
    ).toBeDisabled()
  })

  it('a provider failure keeps the last price and says so', async () => {
    server.use(
      http.get(`${I}/i-1`, () => HttpResponse.json(btc)),
      http.post(`${I}/i-1/refresh-price`, () =>
        HttpResponse.json(errorEnvelope('UPSTREAM_PROVIDER_ERROR'), { status: 502 }),
      ),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/investments/i-1')
    await user.click(await screen.findByRole('button', { name: 'Refresh price' }))
    expect(
      await screen.findByText('The price provider is unavailable right now. Please try again.'),
    ).toBeInTheDocument()
    expect(screen.getByTestId('valuation')).toHaveTextContent('IDR 10,400,000')
  })

  it('hides refresh for manually priced investments', async () => {
    server.use(http.get(`${I}/i-2`, () => HttpResponse.json(bbca)))
    renderApp('/s/s-1/investments/i-2')
    await screen.findByTestId('valuation')
    expect(screen.queryByRole('button', { name: /Refresh/ })).not.toBeInTheDocument()
    expect(screen.getAllByText('Typed price').length).toBeGreaterThan(0)
  })

  it('a shared-in investment offers no edit affordance anywhere, and shows my share beside the total', async () => {
    server.use(http.get(`${I}/i-3`, () => HttpResponse.json(sharedIn)))
    renderApp('/s/s-1/investments/i-3')
    const compare = await screen.findByTestId('share-compare')
    expect(compare).toHaveTextContent('My share (25.00%)')
    expect(compare).toHaveTextContent('IDR 10,400,000') // total
    for (const name of [/^Buy$/, /^Sell$/, /^Share$/, /^Delete$/, /Refresh/]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument()
    }
    expect(screen.getByText(/read-only/)).toBeInTheDocument()
  })

  it('shows the no-access state when the investment is missing (404)', async () => {
    server.use(
      http.get(`${I}/i-9`, () => HttpResponse.json(errorEnvelope('NOT_FOUND'), { status: 404 })),
    )
    renderApp('/s/s-1/investments/i-9')
    expect(await screen.findByText('You no longer have access')).toBeInTheDocument()
  })

  it('deletes after confirming', async () => {
    const deleted = vi.fn()
    server.use(
      http.get(`${I}/i-2`, () => HttpResponse.json(bbca)),
      http.delete(`${I}/i-2`, () => {
        deleted()
        return new HttpResponse(null, { status: 204 })
      }),
      http.get(I, () => HttpResponse.json(list([]))),
    )
    const user = userEvent.setup()
    const { router } = renderApp('/s/s-1/investments/i-2')
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete this investment?' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(deleted).toHaveBeenCalled())
    await waitFor(() => expect(router.state.location.pathname).toBe('/s/s-1/investments'))
  })
})

describe('buy and sell', () => {
  const inv = {
    ...btc,
    quantity: '10',
    avgBuyPrice: '100',
  }
  beforeEach(() => server.use(http.get(`${I}/i-1`, () => HttpResponse.json(inv))))

  async function openTrade(user: ReturnType<typeof userEvent.setup>, name: 'Buy' | 'Sell') {
    renderApp('/s/s-1/investments/i-1')
    await user.click(await screen.findByRole('button', { name: new RegExp(`^${name}$`) }))
    return screen.findByRole('dialog', { name: new RegExp(name) })
  }

  it('previews the resulting position before a buy, then sends wallet -> investment', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post(`${BASE}/spaces/s-1/transfers`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 't-1' }, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    const sheet = await openTrade(user, 'Buy')
    const buy = within(sheet).getByRole('button', { name: 'Buy' })
    expect(buy).toBeDisabled()
    await user.type(within(sheet).getByLabelText('Quantity'), '10')
    await user.type(within(sheet).getByLabelText(/Unit price/), '200')
    await user.type(within(sheet).getByLabelText('Fee (optional)'), '5')
    const preview = within(sheet).getByTestId('trade-preview')
    expect(preview).toHaveTextContent('20') // new quantity
    expect(preview).toHaveTextContent('$150.00') // new average
    expect(preview).toHaveTextContent('$2,005.00') // cost incl. the fee
    await user.click(buy)
    await waitFor(() =>
      expect(body).toMatchObject({
        from: { type: 'WALLET', walletId: 'w-1' },
        to: { type: 'INVESTMENT', investmentId: 'i-1', quantity: '10', unitPrice: '200', fee: '5' },
      }),
    )
  })

  it('a sell previews realised P/L and goes investment -> wallet', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post(`${BASE}/spaces/s-1/transfers`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 't-1' }, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    const sheet = await openTrade(user, 'Sell')
    await user.type(within(sheet).getByLabelText('Quantity'), '4')
    await user.type(within(sheet).getByLabelText(/Unit price/), '150')
    await user.type(within(sheet).getByLabelText('Fee (optional)'), '10')
    expect(within(sheet).getByTestId('trade-preview')).toHaveTextContent('+$190.00') // (150-100) x 4 - 10
    await user.click(within(sheet).getByRole('button', { name: 'Sell' }))
    await waitFor(() =>
      expect(body).toMatchObject({
        from: { type: 'INVESTMENT', investmentId: 'i-1', quantity: '4', unitPrice: '150' },
        to: { type: 'WALLET', walletId: 'w-1' },
      }),
    )
  })

  it('lets you sell everything held, and refuses more than that', async () => {
    const called = vi.fn()
    server.use(
      http.post(`${BASE}/spaces/s-1/transfers`, () => {
        called()
        return HttpResponse.json({}, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    const sheet = await openTrade(user, 'Sell')
    expect(within(sheet).getByText('You can sell up to 10')).toBeInTheDocument()
    await user.type(within(sheet).getByLabelText('Quantity'), '10.01')
    await user.type(within(sheet).getByLabelText(/Unit price/), '1')
    expect(within(sheet).getByText("You don't hold that much to sell.")).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Sell' })).toBeDisabled()
    expect(called).not.toHaveBeenCalled()
  })

  it('explains INSUFFICIENT_QUANTITY in plain words', async () => {
    server.use(
      http.post(`${BASE}/spaces/s-1/transfers`, () =>
        HttpResponse.json(errorEnvelope('INSUFFICIENT_QUANTITY'), { status: 422 }),
      ),
    )
    const user = userEvent.setup()
    const sheet = await openTrade(user, 'Sell')
    await user.type(within(sheet).getByLabelText('Quantity'), '1')
    await user.type(within(sheet).getByLabelText(/Unit price/), '1')
    await user.click(within(sheet).getByRole('button', { name: 'Sell' }))
    expect(await within(sheet).findByRole('alert')).toHaveTextContent(
      "You don't hold enough to sell that quantity.",
    )
  })

  it('POSITION_CHANGED_SINCE offers a refresh that refetches the investment', async () => {
    let fetches = 0
    server.use(
      http.get(`${I}/i-1`, () => {
        fetches++
        return HttpResponse.json(inv)
      }),
      http.post(`${BASE}/spaces/s-1/transfers`, () =>
        HttpResponse.json(errorEnvelope('POSITION_CHANGED_SINCE'), { status: 409 }),
      ),
    )
    const user = userEvent.setup()
    const sheet = await openTrade(user, 'Buy')
    await user.type(within(sheet).getByLabelText('Quantity'), '1')
    await user.type(within(sheet).getByLabelText(/Unit price/), '1')
    await user.click(within(sheet).getByRole('button', { name: 'Buy' }))
    expect(
      await within(sheet).findByText(/position changed since you opened it/i),
    ).toBeInTheDocument()
    const before = fetches
    await user.click(within(sheet).getByRole('button', { name: 'Refresh position' }))
    await waitFor(() => expect(fetches).toBeGreaterThan(before))
  })
})

describe('sharing', () => {
  const participants = [
    {
      id: 'p-1',
      role: 'OWNER',
      displayName: 'Jane',
      isMe: true,
      sharePct: '100.00',
      shareBps: 10000,
      status: 'ACTIVE',
    },
  ]
  beforeEach(() =>
    server.use(
      http.get(`${I}/i-1`, () => HttpResponse.json(btc)),
      http.get(`${I}/i-1/participants`, () => HttpResponse.json({ items: participants })),
    ),
  )

  const total = () => screen.getByTestId('share-total')

  it('shows a running total, and 99.99% cannot be submitted', async () => {
    const user = userEvent.setup()
    renderApp('/s/s-1/investments/i-1/sharing')
    await screen.findByLabelText('Jane share percent')
    expect(total()).toHaveTextContent('100.00%')
    await user.click(screen.getByRole('button', { name: /Add person/ }))
    await user.type(screen.getAllByLabelText('Name').at(-1) as HTMLElement, 'Bob')
    await user.clear(screen.getByLabelText('Jane share percent'))
    await user.type(screen.getByLabelText('Jane share percent'), '50')
    await user.type(screen.getByLabelText('Bob share percent'), '49.99')
    expect(total()).toHaveTextContent('99.99%') // visible while editing
    expect(total()).toHaveTextContent('Shares must add up to exactly 100.00%.')
    expect(screen.getByRole('button', { name: 'Save sharing' })).toBeDisabled()
  })

  it('saves a 50/50 split as a full replacement', async () => {
    let body: unknown
    server.use(
      http.put(`${I}/i-1/participants`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ items: participants })
      }),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/investments/i-1/sharing')
    await screen.findByLabelText('Jane share percent')
    await user.click(screen.getByRole('button', { name: /Add person/ }))
    await user.type(screen.getAllByLabelText('Name').at(-1) as HTMLElement, 'Bob')
    await user.type(screen.getByLabelText('Email (optional)'), 'bob@example.com')
    await user.clear(screen.getByLabelText('Jane share percent'))
    await user.type(screen.getByLabelText('Jane share percent'), '50')
    await user.type(screen.getByLabelText('Bob share percent'), '50')
    expect(total()).toHaveTextContent('50.00%'.replace('50', '100')) // 100.00%
    await user.click(screen.getByRole('button', { name: 'Save sharing' }))
    await waitFor(() =>
      expect(body).toEqual({
        participants: [
          { displayName: 'Jane', sharePct: '50.00', isOwner: true },
          { displayName: 'Bob', sharePct: '50.00', email: 'bob@example.com' },
        ],
      }),
    )
  })

  it('stays on the sharing page after saving, keeps the rows and shows a toast (S1)', async () => {
    let listFetches = 0
    server.use(
      http.get(I, () => {
        listFetches++
        return HttpResponse.json(list([btc]))
      }),
      http.put(`${I}/i-1/participants`, () => HttpResponse.json({ items: participants })),
    )
    const user = userEvent.setup()
    const { router } = renderApp('/s/s-1/investments/i-1/sharing')
    await screen.findByLabelText('Jane share percent')
    await user.click(screen.getByRole('button', { name: 'Save sharing' }))
    expect(await screen.findByText('Sharing saved')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Jane share percent')).toHaveValue('100.00'))
    expect(router.state.location.pathname).toBe('/s/s-1/investments/i-1/sharing')
    expect(listFetches).toBeLessThanOrEqual(1)
  })

  it('stops at 10 people', async () => {
    const user = userEvent.setup()
    renderApp('/s/s-1/investments/i-1/sharing')
    await screen.findByLabelText('Jane share percent')
    for (let i = 0; i < 9; i++) await user.click(screen.getByRole('button', { name: /Add person/ }))
    expect(screen.getByRole('button', { name: /Add person/ })).toBeDisabled()
  })

  it('explains a server-side share total failure', async () => {
    server.use(
      http.put(`${I}/i-1/participants`, () =>
        HttpResponse.json(errorEnvelope('SHARE_TOTAL_INVALID'), { status: 422 }),
      ),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/investments/i-1/sharing')
    await screen.findByLabelText('Jane share percent')
    await user.click(screen.getByRole('button', { name: 'Save sharing' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Shares must add up to exactly 100%.',
    )
  })

  it("a participant can't edit sharing of an investment shared with them", async () => {
    server.use(http.get(`${I}/i-3`, () => HttpResponse.json(sharedIn)))
    renderApp('/s/s-1/investments/i-3/sharing')
    expect(await screen.findByText('Only the owner can change sharing')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save sharing' })).not.toBeInTheDocument()
  })
})

describe('investment access (S1)', () => {
  it('shows "You no longer have access" on INVESTMENT_NOT_FOUND instead of a skeleton loop', async () => {
    server.use(
      http.get(`${I}/i-9`, () =>
        HttpResponse.json(errorEnvelope('INVESTMENT_NOT_FOUND'), { status: 404 }),
      ),
    )
    renderApp('/s/s-1/investments/i-9')
    expect(await screen.findByText('You no longer have access')).toBeInTheDocument()
  })
})

describe('invitation inbox', () => {
  const invitation = {
    participantId: 'pp-1',
    ownerName: 'Alice',
    shareBps: 2500,
    sharePct: '25.00',
    investment: { name: 'Family ETF', symbol: 'VOO', icon: '🌐' },
  }

  it('lists invitations and accepts into a chosen space', async () => {
    let body: unknown
    server.use(
      http.get(`${BASE}/me/shared-investment-invitations`, () => HttpResponse.json([invitation])),
      http.post(`${BASE}/me/shared-investment-invitations/pp-1/accept`, async ({ request }) => {
        body = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    renderApp('/invitations/shared')
    expect(await screen.findByText(/Family ETF \(VOO\)/)).toBeInTheDocument()
    expect(screen.getByText(/From Alice · your share 25.00%/)).toBeInTheDocument()
    await user.selectOptions(
      screen.getByLabelText('Add it to space'),
      ownerSpace.id === 's-1' ? sharedSpace.id : ownerSpace.id,
    )
    await user.click(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(body).toEqual({ spaceId: 's-2' }))
  })

  it('declines', async () => {
    const declined = vi.fn()
    server.use(
      http.get(`${BASE}/me/shared-investment-invitations`, () => HttpResponse.json([invitation])),
      http.post(`${BASE}/me/shared-investment-invitations/pp-1/decline`, () => {
        declined()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    renderApp('/invitations/shared')
    await user.click(await screen.findByRole('button', { name: 'Decline' }))
    await waitFor(() => expect(declined).toHaveBeenCalled())
  })

  it('explains an invitation that was already answered', async () => {
    server.use(
      http.get(`${BASE}/me/shared-investment-invitations`, () => HttpResponse.json([invitation])),
      http.post(`${BASE}/me/shared-investment-invitations/pp-1/accept`, () =>
        HttpResponse.json(errorEnvelope('SHARE_INVITATION_ANSWERED'), { status: 409 }),
      ),
    )
    const user = userEvent.setup()
    renderApp('/invitations/shared')
    await user.click(await screen.findByRole('button', { name: 'Accept' }))
    expect(
      await screen.findByText('This invitation has already been answered.'),
    ).toBeInTheDocument()
  })

  it('has empty and error states', async () => {
    server.use(http.get(`${BASE}/me/shared-investment-invitations`, () => HttpResponse.json([])))
    renderApp('/invitations/shared')
    expect(await screen.findByText('No invitations')).toBeInTheDocument()
  })
})
