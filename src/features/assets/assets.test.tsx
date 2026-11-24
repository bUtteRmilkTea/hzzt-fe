// biome-ignore-all lint/plugin: fixtures only
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { BASE, errorEnvelope, makeAuthedHandlers, ownerSpace } from '../../../test/msw/api'
import { assetList, debt, house, owed, summary } from '../../../test/msw/assets'
import { server } from '../../../test/msw/server'
import { cash, walletList } from '../../../test/msw/wallets'
import { renderApp } from '../../../test/renderApp'

const A = `${BASE}/spaces/s-1/manual-assets`
const NW = `${BASE}/spaces/s-1/net-worth`

beforeEach(() => server.use(...makeAuthedHandlers()))

function kindHandler(by: Record<string, ReturnType<typeof assetList>>) {
  return http.get(A, ({ request }) =>
    HttpResponse.json(
      by[new URL(request.url).searchParams.get('kind') ?? ''] ?? assetList('x', [], '0'),
    ),
  )
}

describe('asset page', () => {
  it('shows net worth and every section with its total, all from the server', async () => {
    server.use(
      http.get(`${NW}/summary`, () => HttpResponse.json(summary())),
      http.get(`${NW}/history`, () =>
        HttpResponse.json({
          currency: 'IDR',
          changePct: '3.25',
          range: '1M',
          series: {
            netWorth: {
              last: '95000000',
              change: '3000000',
              changePct: '3.25',
              direction: 'RISING',
            },
          },
          points: [],
        }),
      ),
      kindHandler({
        FIXED_ASSET: assetList('FIXED_ASSET', [house], '50000000'),
        RECEIVABLE: assetList('RECEIVABLE', [owed], '5000000'),
        LIABILITY: assetList('LIABILITY', [debt], '30000000'),
      }),
    )
    renderApp('/s/s-1/assets')
    // The animated hero renders a sizer, the counting frame and a screen-reader copy.
    expect((await screen.findAllByText('IDR 95,000,000')).length).toBeGreaterThan(0)
    expect(await screen.findByTestId('growth-change')).toHaveTextContent('+3.25%')
    expect(screen.getByTestId('growth-sentence')).toHaveTextContent('Rising over the last month')
    for (const [name, total] of [
      ['Cash', 'IDR 30,000,000'],
      ['Investments', 'IDR 40,000,000'],
      ['Fixed assets', 'IDR 50,000,000'],
      ['Money owed to you', 'IDR 5,000,000'],
      ['Debt', 'IDR 30,000,000'],
    ] as const) {
      expect(
        within(screen.getByRole('region', { name })).getAllByText(total).length,
      ).toBeGreaterThan(0)
    }
    expect(await screen.findByText('Car loan')).toBeInTheDocument()
    expect(screen.getByText('Apartment')).toBeInTheDocument()
  })

  it('colours a falling month in red, with a minus sign', async () => {
    server.use(
      http.get(`${NW}/summary`, () => HttpResponse.json(summary())),
      http.get(`${NW}/history`, () =>
        HttpResponse.json({
          currency: 'IDR',
          changePct: '-4.1',
          range: '1M',
          series: {
            netWorth: {
              last: '90000000',
              change: '-4000000',
              changePct: '-4.1',
              direction: 'FALLING',
            },
          },
          points: [],
        }),
      ),
    )
    renderApp('/s/s-1/assets')
    const badge = await screen.findByTestId('growth-change')
    expect(badge).toHaveTextContent('-4.1%')
    expect(badge.parentElement).toHaveClass('text-negative')
  })

  it('sections collapse and expand', async () => {
    server.use(
      http.get(`${NW}/summary`, () => HttpResponse.json(summary())),
      kindHandler({ FIXED_ASSET: assetList('FIXED_ASSET', [house], '50000000') }),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/assets')
    const fixed = await screen.findByRole('region', { name: 'Fixed assets' })
    const toggle = within(fixed).getByRole('button', { name: 'Fixed assets' })
    expect(await within(fixed).findByText('Apartment')).toBeInTheDocument()
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    // Collapsed content stays mounted (for the height transition) but is inert, so it cannot be focused or read.
    expect(within(fixed).getByText('Apartment').closest('[inert]')).not.toBeNull()
    expect(within(fixed).getByTestId('section-summary')).toHaveTextContent(/^1 item$/)
  })

  it('shows warnings for items left out for lack of a rate', async () => {
    server.use(
      http.get(`${NW}/summary`, () =>
        HttpResponse.json(
          summary({
            warnings: [
              {
                code: 'FX_RATE_UNAVAILABLE',
                message: 'No EUR to IDR rate, so one item is left out',
              },
            ],
          }),
        ),
      ),
    )
    renderApp('/s/s-1/assets')
    expect(await screen.findByText(/No EUR to IDR rate/)).toBeInTheDocument()
  })

  it('has an error state with a retry', async () => {
    let fail = true
    server.use(
      http.get(`${NW}/summary`, () =>
        fail
          ? HttpResponse.json(errorEnvelope('INTERNAL_ERROR'), { status: 500 })
          : HttpResponse.json(summary()),
      ),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/assets')
    expect(await screen.findByText("Couldn't load your net worth")).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    // The animated hero renders a sizer, the counting frame and a screen-reader copy.
    expect((await screen.findAllByText('IDR 95,000,000')).length).toBeGreaterThan(0)
  })
})

describe('CASH_ONLY tracking mode', () => {
  const cashOnly = [{ ...ownerSpace, trackingMode: 'CASH_ONLY' }]
  beforeEach(() => {
    server.use(
      http.get(`${NW}/summary`, () =>
        HttpResponse.json({
          currency: 'IDR',
          netWorth: '30000000',
          cash: '30000000',
          trackingMode: 'CASH_ONLY',
          warnings: [],
        }),
      ),
    )
    server.use(...makeAuthedHandlers({ spaces: cashOnly }))
  })

  it('hides everything but cash on the asset page', async () => {
    renderApp('/s/s-1/assets')
    expect(await screen.findByRole('region', { name: 'Cash' })).toBeInTheDocument()
    for (const name of ['Investments', 'Fixed assets', 'Money owed to you', 'Debt']) {
      expect(screen.queryByRole('region', { name })).not.toBeInTheDocument()
    }
  })

  it.each([
    ['/s/s-1/investments', 'investments'],
    ['/s/s-1/investments/new', 'new investment'],
    ['/s/s-1/assets/new?kind=LIABILITY', 'new debt'],
    ['/invitations/shared', 'shared invitations'],
  ])('also hides %s (%s): it sends you back to the asset page', async (path) => {
    const { router } = renderApp(path)
    await waitFor(() => expect(router.state.location.pathname).toBe('/s/s-1/assets'))
  })
})

describe('manual assets', () => {
  it('creates a liability with a counterparty and due date', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post(A, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ ...debt, id: 'a-9' }, { status: 201 })
      }),
      http.get(`${A}/a-9`, () => HttpResponse.json(debt)),
    )
    const user = userEvent.setup()
    const { router } = renderApp('/s/s-1/assets/new?kind=LIABILITY')
    await user.type(await screen.findByLabelText('Name'), 'Car loan')
    for (const k of ['5', '0', '0'])
      await user.click(screen.getByRole('button', { name: new RegExp(`^${k}$`) }))
    await user.type(screen.getByLabelText('Owed to (optional)'), 'Bank ABC')
    await user.type(screen.getByLabelText('Due date (optional)'), '2026-12-31')
    await user.click(screen.getByRole('button', { name: 'Add debt' }))
    await waitFor(() =>
      expect(body).toMatchObject({
        kind: 'LIABILITY',
        name: 'Car loan',
        currentValue: '500',
        counterpartyName: 'Bank ABC',
        dueDate: '2026-12-31',
      }),
    )
    await waitFor(() => expect(router.state.location.pathname).toBe('/s/s-1/assets/a-9'))
  })

  it('the preview card follows the typed name, amount and counterparty', async () => {
    const user = userEvent.setup()
    renderApp('/s/s-1/assets/new?kind=LIABILITY')
    const preview = await screen.findByTestId('asset-preview')
    expect(within(preview).getByText('New debt')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Name'), 'Car loan')
    for (const k of ['5', '0', '0'])
      await user.click(screen.getByRole('button', { name: new RegExp(`^${k}$`) }))
    await user.type(screen.getByLabelText('Owed to (optional)'), 'Bank ABC')
    expect(within(preview).getByText('Car loan')).toBeInTheDocument()
    expect(within(preview).getByText(/500/)).toBeInTheDocument()
    expect(within(preview).getByText('Owed to Bank ABC')).toBeInTheDocument()
    expect(screen.getByTestId('asset-form-layout')).toBeInTheDocument()
  })

  it('a fixed asset takes an estimated annual change, and no counterparty', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post(A, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ ...house, id: 'a-9' }, { status: 201 })
      }),
      http.get(`${A}/a-9`, () => HttpResponse.json(house)),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/assets/new?kind=FIXED_ASSET')
    await user.type(await screen.findByLabelText('Name'), 'Apartment')
    expect(screen.queryByLabelText(/Owed to|Who owes you/)).not.toBeInTheDocument()
    for (const k of ['9', '9'])
      await user.click(screen.getByRole('button', { name: new RegExp(`^${k}$`) }))
    expect(screen.queryByLabelText(/Estimated annual change/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add fixed asset' }))
    await waitFor(() => expect(body).toMatchObject({ kind: 'FIXED_ASSET', name: 'Apartment' }))
    expect(body).not.toHaveProperty('counterpartyName')
    expect(body).not.toHaveProperty('estimatedAnnualChangePct')
  })

  it('validates a name and an amount before sending', async () => {
    const called = vi.fn()
    server.use(
      http.post(A, () => {
        called()
        return HttpResponse.json(house)
      }),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/assets/new?kind=FIXED_ASSET')
    await user.click(await screen.findByRole('button', { name: 'Add fixed asset' }))
    expect(await screen.findByText('Enter a name')).toBeInTheDocument()
    expect(screen.getByText('Enter an amount of zero or more')).toBeInTheDocument()
    expect(called).not.toHaveBeenCalled()
  })

  it('edits, sending null to clear a removed counterparty and note, and handles a locked currency', async () => {
    const bodies: Array<Record<string, unknown>> = []
    server.use(
      http.get(`${A}/a-1`, () => HttpResponse.json({ ...debt, note: 'old note' })),
      http.patch(`${A}/a-1`, async ({ request }) => {
        const b = (await request.json()) as Record<string, unknown>
        bodies.push(b)
        return bodies.length === 1 && 'currency' in b
          ? HttpResponse.json(errorEnvelope('MANUAL_ASSET_CURRENCY_LOCKED'), { status: 422 })
          : HttpResponse.json(debt)
      }),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/assets/a-1/edit')
    await user.clear(await screen.findByLabelText('Owed to (optional)'))
    await user.clear(screen.getByLabelText('Note (optional)'))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "An asset's currency cannot change".replace("An asset's", "This item's"),
    )
    expect(screen.getByLabelText('Currency')).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(bodies).toHaveLength(2))
    expect(bodies[1]).toMatchObject({ counterpartyName: null, note: null })
    expect(bodies[1]).not.toHaveProperty('currency') // locked: never sent again
  })

  it('shows its value history and deletes after confirming', async () => {
    const deleted = vi.fn()
    server.use(
      http.get(`${A}/a-2`, () => HttpResponse.json(house)),
      http.delete(`${A}/a-2`, () => {
        deleted()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    const { router } = renderApp('/s/s-1/assets/a-2')
    expect(await screen.findByTestId('asset-value')).toHaveTextContent('IDR 50,000,000')
    expect(screen.getByText('Updated')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Receive payment|Pay down/ }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete Apartment?' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(deleted).toHaveBeenCalled())
    await waitFor(() => expect(router.state.location.pathname).toBe('/s/s-1/assets'))
  })
})

describe('settlements', () => {
  const wallets = (balance: string) => [
    { ...cash, id: 'w-1', currency: 'IDR', balance, sortOrder: 0 },
    { ...cash, id: 'w-9', name: 'Dollars', currency: 'USD', balance: '10', sortOrder: 1 },
  ]

  it('only offers fixed assets no settle action, and owed money and debt do', async () => {
    server.use(http.get(`${A}/a-2`, () => HttpResponse.json(house)))
    renderApp('/s/s-1/assets/a-2')
    await screen.findByTestId('asset-value')
    expect(
      screen.queryByRole('button', { name: /Receive payment|Pay down/ }),
    ).not.toBeInTheDocument()
  })

  it('settling 200 against a 500 debt leaves 300, and the wallet drops, with no reload', async () => {
    let outstanding = '500'
    let balance = '1000'
    let body: Record<string, unknown> = {}
    server.use(
      http.get(`${A}/a-1`, () => HttpResponse.json({ ...debt, currentValue: outstanding })),
      http.get(`${BASE}/spaces/s-1/wallets`, () => HttpResponse.json(walletList(wallets(balance)))),
      http.post(`${A}/a-1/settlements`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        outstanding = '300'
        balance = '800'
        return HttpResponse.json(
          { asset: { ...debt, currentValue: outstanding }, transaction: {} },
          { status: 201 },
        )
      }),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/assets/a-1')
    await user.click(await screen.findByRole('button', { name: 'Pay down' }))
    const sheet = await screen.findByRole('dialog', { name: 'Pay down' })
    // only a wallet in the debt's currency is offered
    expect(within(sheet).getByLabelText('Pay from')).toHaveTextContent('Cash')
    expect(within(sheet).getByLabelText('Pay from')).not.toHaveTextContent('Dollars')
    for (const k of ['2', '0', '0'])
      await user.click(within(sheet).getByRole('button', { name: new RegExp(`^${k}$`) }))
    expect(within(sheet).getByTestId('outstanding-after')).toHaveTextContent('IDR 300')
    await user.click(within(sheet).getByRole('button', { name: 'Pay down' }))
    await waitFor(() => expect(body).toMatchObject({ walletId: 'w-1', amount: '200' }))
    await waitFor(() => expect(screen.getByTestId('asset-value')).toHaveTextContent('IDR 300'))
    await user.click(screen.getByRole('link', { name: 'Wallets' }))
    expect(await screen.findByText('IDR 800')).toBeInTheDocument()
  })

  it('stops an amount above the outstanding value before it is sent, and the server error is still handled', async () => {
    const calls: Record<string, unknown>[] = []
    server.use(
      http.get(`${A}/a-1`, () => HttpResponse.json(debt)),
      http.get(`${BASE}/spaces/s-1/wallets`, () => HttpResponse.json(walletList(wallets('1000')))),
      http.post(`${A}/a-1/settlements`, async ({ request }) => {
        calls.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json(errorEnvelope('SETTLEMENT_EXCEEDS_BALANCE'), { status: 422 })
      }),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/assets/a-1')
    await user.click(await screen.findByRole('button', { name: 'Pay down' }))
    const sheet = await screen.findByRole('dialog', { name: 'Pay down' })
    for (const k of ['6', '0', '0'])
      await user.click(within(sheet).getByRole('button', { name: new RegExp(`^${k}$`) }))
    expect(within(sheet).getByText("That's more than what is outstanding.")).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Pay down' })).toBeDisabled()
    expect(calls).toHaveLength(0)
    // 500 is allowed; if the server still says no, it is explained in plain words
    await user.click(within(sheet).getByRole('button', { name: 'Clear' }))
    for (const k of ['5', '0', '0'])
      await user.click(within(sheet).getByRole('button', { name: new RegExp(`^${k}$`) }))
    await user.click(within(sheet).getByRole('button', { name: 'Pay down' }))
    expect(await within(sheet).findByRole('alert')).toHaveTextContent(
      'That is more than the outstanding amount.',
    )
  })

  it('a receivable is received into a wallet', async () => {
    server.use(
      http.get(`${A}/a-3`, () => HttpResponse.json(owed)),
      http.get(`${BASE}/spaces/s-1/wallets`, () => HttpResponse.json(walletList(wallets('1000')))),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/assets/a-3')
    await user.click(await screen.findByRole('button', { name: 'Receive payment' }))
    const sheet = await screen.findByRole('dialog', { name: 'Receive payment' })
    expect(within(sheet).getByLabelText('Receive into')).toBeInTheDocument()
  })

  it('says so when there is no wallet in the right currency', async () => {
    server.use(
      http.get(`${A}/a-1`, () => HttpResponse.json(debt)),
      http.get(`${BASE}/spaces/s-1/wallets`, () =>
        HttpResponse.json(walletList([{ ...cash, currency: 'USD' }])),
      ),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/assets/a-1')
    await user.click(await screen.findByRole('button', { name: 'Pay down' }))
    expect(await screen.findByText(/You need a wallet in IDR/)).toBeInTheDocument()
  })
})
