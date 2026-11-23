// biome-ignore-all lint/plugin: hex strings here are test inputs typed into the colour field
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { BASE, errorEnvelope, makeAuthedHandlers } from '../../../test/msw/api'
import { server } from '../../../test/msw/server'
import { bank, cash, presets, savings, templates, txn, walletList } from '../../../test/msw/wallets'
import { renderApp } from '../../../test/renderApp'

const W = `${BASE}/spaces/s-1/wallets`

/** A keypad button by its exact label (so '1' does not also match '10'). */
const key = (root: HTMLElement, label: string) =>
  within(root).getByRole('button', { name: new RegExp(`^${label}$`) })
const noTxns = http.get(`${BASE}/spaces/s-1/transactions`, () => HttpResponse.json({ items: [] }))

describe('wallet list', () => {
  it('shows favourites first, the server total, and the warnings strip', async () => {
    server.use(
      http.get(W, () =>
        HttpResponse.json(
          walletList([cash, bank, savings], {
            total: '1750000',
            currency: 'IDR',
            warnings: [
              {
                code: 'FX_RATE_UNAVAILABLE',
                message: 'No USD to IDR rate, so Savings is left out',
              },
            ],
          }),
        ),
      ),
      ...makeAuthedHandlers(),
    )
    renderApp('/s/s-1/wallets')
    const cards = await screen.findAllByRole('link', { name: /open wallet/ })
    // Savings is a favourite, then BCA (sortOrder 0), then Cash (1)
    expect(cards.map((c) => c.textContent?.match(/Savings|BCA|Cash/)?.[0])).toEqual([
      'Savings',
      'BCA',
      'Cash',
    ])
    expect(screen.getByTestId('wallets-total')).toHaveTextContent('1,750,000')
    expect(screen.getByText(/No USD to IDR rate/)).toBeInTheDocument()
  })

  it('never recomputes the total on the client', async () => {
    server.use(
      http.get(W, () =>
        HttpResponse.json(
          walletList([cash, bank], { total: '999', currency: 'IDR', warnings: [] }),
        ),
      ),
      ...makeAuthedHandlers(),
    )
    renderApp('/s/s-1/wallets')
    expect(await screen.findByTestId('wallets-total')).toHaveTextContent('999')
  })

  it('shows the empty state with one action', async () => {
    server.use(...makeAuthedHandlers())
    renderApp('/s/s-1/wallets')
    expect(await screen.findByText('No wallets yet')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Add wallet/ }).length).toBeGreaterThan(0)
  })

  it('shows an error state with a retry', async () => {
    let fail = true
    server.use(
      http.get(W, () =>
        fail
          ? HttpResponse.json(errorEnvelope('INTERNAL_ERROR'), { status: 500 })
          : HttpResponse.json(walletList([cash])),
      ),
      ...makeAuthedHandlers(),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/wallets')
    expect(await screen.findByText("Couldn't load your wallets")).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('link', { name: /Cash.*open wallet/ })).toBeInTheDocument()
  })

  it('shows skeletons while loading', async () => {
    server.use(
      http.get(W, async () => {
        await new Promise((r) => setTimeout(r, 100))
        return HttpResponse.json(walletList([cash]))
      }),
      ...makeAuthedHandlers(),
    )
    renderApp('/s/s-1/wallets')
    await screen.findByRole('heading', { name: 'Wallets' })
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument()
    await screen.findByRole('link', { name: /Cash.*open wallet/ })
  })
})

describe('reordering', () => {
  it('moves a wallet and sends the full order', async () => {
    let body: unknown
    server.use(
      http.put(`${W}/order`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(walletList([cash, bank]))
      }),
      http.get(W, () => HttpResponse.json(walletList([bank, cash]))),
      ...makeAuthedHandlers(),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/wallets')
    await screen.findByRole('link', { name: /BCA.*open wallet/ })
    await user.click(screen.getByRole('button', { name: 'Reorder' }))
    expect(screen.getByRole('button', { name: 'Move BCA up' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Move Cash up' }))
    await waitFor(() => expect(body).toEqual({ ids: ['w-1', 'w-2'] }))
  })

  it('snaps back and tells the user when the server refuses', async () => {
    server.use(
      http.put(`${W}/order`, () =>
        HttpResponse.json(errorEnvelope('INTERNAL_ERROR'), { status: 500 }),
      ),
      http.get(W, () => HttpResponse.json(walletList([bank, cash]))),
      ...makeAuthedHandlers(),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/wallets')
    await screen.findByRole('link', { name: /BCA.*open wallet/ })
    await user.click(screen.getByRole('button', { name: 'Reorder' }))
    await user.click(screen.getByRole('button', { name: 'Move Cash up' }))
    const order = () =>
      screen
        .getAllByRole('link', { name: /open wallet/ })
        .map((a) => a.textContent?.match(/BCA|Cash/)?.[0])
    await waitFor(() => expect(order()).toEqual(['BCA', 'Cash']))
    expect(await screen.findByText(/Something went wrong on our side/)).toBeInTheDocument()
  })
})

describe('create wallet', () => {
  async function fillCommon(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: /Add wallet/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Add wallet' })
    await user.type(within(sheet).getByLabelText('Name'), 'Dana')
    return sheet
  }

  it('creates a wallet with an initial balance typed on the calculator, then opens it', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post(W, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ ...cash, id: 'w-9', name: 'Dana' }, { status: 201 })
      }),
      http.get(`${W}/w-9`, () => HttpResponse.json({ ...cash, id: 'w-9', name: 'Dana' })),
      noTxns,
      ...makeAuthedHandlers(),
    )
    const user = userEvent.setup()
    const { router } = renderApp('/s/s-1/wallets')
    const sheet = await fillCommon(user)
    for (const k of ['1', '0', '0', '0']) await user.click(key(sheet, k))
    await user.click(within(sheet).getByRole('button', { name: 'Add wallet' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/s/s-1/wallets/w-9'))
    expect(body).toMatchObject({
      name: 'Dana',
      type: 'BANK',
      currency: 'IDR',
      initialBalance: '1000',
      cardStyle: { mode: 'SOLID' },
    })
  })

  it('omits the initial balance when left empty or zero', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post(W, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ ...cash, id: 'w-9' }, { status: 201 })
      }),
      http.get(`${W}/w-9`, () => HttpResponse.json({ ...cash, id: 'w-9' })),
      noTxns,
      ...makeAuthedHandlers(),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/wallets')
    const sheet = await fillCommon(user)
    await user.click(within(sheet).getByRole('button', { name: 'Add wallet' }))
    await waitFor(() => expect(body.name).toBe('Dana'))
    expect(body).not.toHaveProperty('initialBalance')
  })

  it('validates the name before calling the server', async () => {
    const called = vi.fn()
    server.use(
      http.post(W, () => {
        called()
        return HttpResponse.json(cash)
      }),
      ...makeAuthedHandlers(),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/wallets')
    await user.click(await screen.findByRole('button', { name: /Add wallet/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Add wallet' })
    await user.click(within(sheet).getByRole('button', { name: 'Add wallet' }))
    expect(await within(sheet).findByText('Enter a name')).toBeInTheDocument()
    expect(called).not.toHaveBeenCalled()
  })

  it('maps a server validation error onto the field', async () => {
    server.use(
      http.post(W, () =>
        HttpResponse.json(errorEnvelope('VALIDATION_FAILED', '', { name: 'is required' }), {
          status: 400,
        }),
      ),
      ...makeAuthedHandlers(),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/wallets')
    const sheet = await fillCommon(user)
    await user.click(within(sheet).getByRole('button', { name: 'Add wallet' }))
    expect(await within(sheet).findByText('is required')).toBeInTheDocument()
  })
})

describe('wallet detail', () => {
  beforeEach(() => server.use(http.get(`${W}/w-1`, () => HttpResponse.json(cash))))

  it('shows the balance, signed transactions grouped by day, and loads more with the cursor', async () => {
    const cursors: Array<string | null> = []
    server.use(
      http.get(`${BASE}/spaces/s-1/transactions`, ({ request }) => {
        const url = new URL(request.url)
        cursors.push(url.searchParams.get('cursor'))
        expect(url.searchParams.get('walletIds')).toBe('w-1')
        return url.searchParams.get('cursor')
          ? HttpResponse.json({
              items: [txn({ id: 't-3', title: 'Old coffee', occurredAt: '2026-11-16T08:00:00Z' })],
            })
          : HttpResponse.json({
              items: [
                txn(),
                txn({
                  id: 't-2',
                  type: 'INCOME',
                  direction: 'IN',
                  amount: '1000000',
                  title: 'Salary',
                  occurredAt: '2026-11-18T09:00:00Z',
                }),
              ],
              nextCursor: 'cur-2',
            })
      }),
      ...makeAuthedHandlers(),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/wallets/w-1')
    expect(await screen.findByText('Lunch')).toBeInTheDocument()
    expect(screen.getByText('-IDR 50,000')).toBeInTheDocument() // expense is signed negative
    expect(screen.getByText('IDR 1,000,000')).toBeInTheDocument()
    expect(screen.getByText('Wed, 18 Nov')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Load more' }))
    expect(await screen.findByText('Old coffee')).toBeInTheDocument()
    expect(cursors).toEqual([null, 'cur-2'])
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('changing the period updates the URL and the request, and survives a reload', async () => {
    const periods: Array<string | null> = []
    server.use(
      http.get(`${BASE}/spaces/s-1/transactions`, ({ request }) => {
        periods.push(new URL(request.url).searchParams.get('period'))
        return HttpResponse.json({ items: [] })
      }),
      ...makeAuthedHandlers(),
    )
    const user = userEvent.setup()
    const { router } = renderApp('/s/s-1/wallets/w-1')
    await screen.findByText('No transactions in this period')
    await user.click(screen.getByRole('button', { name: /This period/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Period' })
    await user.click(within(sheet).getByRole('button', { name: 'Last 30 days' }))
    await waitFor(() => expect(periods).toContain('LAST_30_DAYS'))
    expect(router.state.location.search).toMatchObject({ period: 'LAST_30_DAYS' })
  })

  it('opens straight to a period given in the URL', async () => {
    const seen: string[] = []
    server.use(
      http.get(`${BASE}/spaces/s-1/transactions`, ({ request }) => {
        const u = new URL(request.url)
        seen.push(`${u.searchParams.get('from')}..${u.searchParams.get('to')}`)
        return HttpResponse.json({ items: [] })
      }),
      ...makeAuthedHandlers(),
    )
    renderApp('/s/s-1/wallets/w-1?from=2026-10-01&to=2026-10-31')
    await screen.findByText('No transactions in this period')
    expect(seen[0]).toBe('2026-10-01..2026-10-31')
    expect(screen.getByRole('button', { name: /1 Oct 2026 – 31 Oct 2026/ })).toBeInTheDocument()
  })

  it('shows an error state for the transaction list with a retry', async () => {
    server.use(
      http.get(`${BASE}/spaces/s-1/transactions`, () =>
        HttpResponse.json(errorEnvelope('INTERNAL_ERROR'), { status: 500 }),
      ),
      ...makeAuthedHandlers(),
    )
    renderApp('/s/s-1/wallets/w-1')
    expect(await screen.findByText("Couldn't load transactions")).toBeInTheDocument()
  })

  it('shows an error state when the wallet itself is missing', async () => {
    server.use(
      http.get(`${W}/w-404`, () => HttpResponse.json(errorEnvelope('NOT_FOUND'), { status: 404 })),
      ...makeAuthedHandlers(),
    )
    renderApp('/s/s-1/wallets/w-404')
    expect(await screen.findByText("Couldn't load this wallet")).toBeInTheDocument()
  })

  it('tops up with a normalised amount and a note', async () => {
    let body: unknown
    server.use(
      http.post(`${W}/w-1/top-up`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(txn({ type: 'INCOME' }), { status: 201 })
      }),
      noTxns,
      ...makeAuthedHandlers(),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/wallets/w-1')
    await user.click(await screen.findByRole('button', { name: /Add balance/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Add balance' })
    const add = within(sheet).getByRole('button', { name: 'Add balance' })
    expect(add).toBeDisabled()
    for (const k of ['5', '0', '0', '0']) await user.click(key(sheet, k))
    await user.type(within(sheet).getByLabelText('Note (optional)'), 'Gift')
    await user.click(add)
    await waitFor(() => expect(body).toEqual({ amount: '5000', note: 'Gift' }))
  })

  it('deletes a zero-balance wallet after one confirmation', async () => {
    const calls: string[] = []
    server.use(
      http.get(`${W}/w-1`, () => HttpResponse.json({ ...cash, balance: '0' })),
      http.delete(`${W}/w-1`, ({ request }) => {
        calls.push(new URL(request.url).search)
        return new HttpResponse(null, { status: 204 })
      }),
      noTxns,
      ...makeAuthedHandlers(),
    )
    const user = userEvent.setup()
    const { router } = renderApp('/s/s-1/wallets/w-1')
    await user.click(await screen.findByRole('button', { name: 'Wallet options' }))
    await user.click(await screen.findByRole('button', { name: /Delete wallet/ }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete this wallet?' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete wallet' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/s/s-1/wallets'))
    expect(calls).toEqual([''])
  })

  it('states the delete impact from the loaded rows and says "at least" when more pages exist', async () => {
    server.use(
      http.get(`${BASE}/spaces/s-1/transactions`, () =>
        HttpResponse.json({
          items: [txn({ id: 't-1' }), txn({ id: 't-2', type: 'TRANSFER' })],
          nextCursor: 'more',
        }),
      ),
      ...makeAuthedHandlers(),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/wallets/w-1')
    await user.click(await screen.findByRole('button', { name: 'Wallet options' }))
    await user.click(await screen.findByRole('button', { name: /Delete wallet/ }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete this wallet?' })
    await waitFor(() =>
      expect(confirm).toHaveTextContent('This also removes at least 1 transaction and 1 transfer.'),
    )
    // The destructive button is not the focused element.
    expect(within(confirm).getByRole('button', { name: 'Delete wallet' })).not.toHaveFocus()
  })

  it('uses the server delete-impact counts and forces the delete the dialog already described', async () => {
    const calls: string[] = []
    server.use(
      http.get(`${W}/w-1/delete-impact`, () =>
        HttpResponse.json({
          balance: '0',
          currency: 'IDR',
          transactions: 12,
          transfers: 3,
          goalReserves: 1,
        }),
      ),
      http.delete(`${W}/w-1`, ({ request }) => {
        calls.push(new URL(request.url).search)
        return new HttpResponse(null, { status: 204 })
      }),
      noTxns,
      ...makeAuthedHandlers(),
    )
    const user = userEvent.setup()
    const { router } = renderApp('/s/s-1/wallets/w-1')
    await user.click(await screen.findByRole('button', { name: 'Wallet options' }))
    await user.click(await screen.findByRole('button', { name: /Delete wallet/ }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete this wallet?' })
    await waitFor(() =>
      expect(confirm).toHaveTextContent(
        'This also removes 12 transactions (3 transfers among them) and 1 goal reservation.',
      ),
    )
    await user.click(within(confirm).getByRole('button', { name: 'Delete wallet' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/s/s-1/wallets'))
    expect(calls).toEqual(['?force=true'])
  })

  it('WALLET_HAS_TRANSACTIONS asks for the explicit second confirmation, like a balance does', async () => {
    const calls: string[] = []
    server.use(
      http.delete(`${W}/w-1`, ({ request }) => {
        const q = new URL(request.url).search
        calls.push(q)
        return q.includes('force=true')
          ? new HttpResponse(null, { status: 204 })
          : HttpResponse.json(errorEnvelope('WALLET_HAS_TRANSACTIONS'), { status: 409 })
      }),
      noTxns,
      ...makeAuthedHandlers(),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/wallets/w-1')
    await user.click(await screen.findByRole('button', { name: 'Wallet options' }))
    await user.click(await screen.findByRole('button', { name: /Delete wallet/ }))
    const first = await screen.findByRole('dialog', { name: 'Delete this wallet?' })
    await user.click(within(first).getByRole('button', { name: 'Delete wallet' }))
    const second = await screen.findByRole('dialog', { name: 'This wallet still has money in it' })
    await user.click(within(second).getByRole('button', { name: 'Delete anyway' }))
    await waitFor(() => expect(calls).toEqual(['', '?force=true']))
  })

  it('explains WALLET_HAS_BALANCE in plain words and needs a second, explicit confirmation to force', async () => {
    const calls: string[] = []
    server.use(
      http.delete(`${W}/w-1`, ({ request }) => {
        const q = new URL(request.url).search
        calls.push(q)
        return q.includes('force=true')
          ? new HttpResponse(null, { status: 204 })
          : HttpResponse.json(errorEnvelope('WALLET_HAS_BALANCE'), { status: 422 })
      }),
      noTxns,
      ...makeAuthedHandlers(),
    )
    const user = userEvent.setup()
    const { router } = renderApp('/s/s-1/wallets/w-1')
    await user.click(await screen.findByRole('button', { name: 'Wallet options' }))
    await user.click(await screen.findByRole('button', { name: /Delete wallet/ }))
    const first = await screen.findByRole('dialog', { name: 'Delete this wallet?' })
    await user.click(within(first).getByRole('button', { name: 'Delete wallet' }))

    const second = await screen.findByRole('dialog', { name: 'This wallet still has money in it' })
    expect(second).toHaveTextContent(/can't be undone/)
    expect(document.body.textContent).not.toContain('WALLET_HAS_BALANCE')
    expect(calls).toEqual(['']) // nothing forced yet

    await user.click(within(second).getByRole('button', { name: 'Delete anyway' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/s/s-1/wallets'))
    expect(calls).toEqual(['', '?force=true'])
  })

  it('toggles favourite', async () => {
    let body: unknown
    server.use(
      http.patch(`${W}/w-1`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ ...cash, isFavorite: true })
      }),
      noTxns,
      ...makeAuthedHandlers(),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/wallets/w-1')
    await user.click(await screen.findByRole('button', { name: 'Wallet options' }))
    await user.click(await screen.findByRole('button', { name: /Add to favourites/ }))
    await waitFor(() => expect(body).toEqual({ isFavorite: true }))
  })
})

describe('edit wallet', () => {
  beforeEach(() => server.use(http.get(`${W}/w-1`, () => HttpResponse.json(cash))))

  it('locks the currency with a reason once the wallet has transactions', async () => {
    server.use(
      http.get(`${BASE}/spaces/s-1/transactions`, () => HttpResponse.json({ items: [txn()] })),
      ...makeAuthedHandlers(),
    )
    renderApp('/s/s-1/wallets/w-1/edit')
    expect(
      await screen.findByText("Currency can't change once a wallet has transactions."),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Currency')).toBeDisabled()
  })

  it('leaves the currency editable on a wallet with no transactions, and sends it', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      noTxns,
      http.patch(`${W}/w-1`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(cash)
      }),
      ...makeAuthedHandlers(),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/wallets/w-1/edit')
    const currency = await screen.findByLabelText('Currency')
    await waitFor(() => expect(currency).toBeEnabled())
    await user.selectOptions(currency, 'USD')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(body).toMatchObject({ currency: 'USD', name: 'Cash' }))
  })

  it('handles WALLET_CURRENCY_LOCKED from the server by explaining and disabling the field', async () => {
    server.use(
      noTxns,
      http.patch(`${W}/w-1`, () =>
        HttpResponse.json(errorEnvelope('WALLET_CURRENCY_LOCKED'), { status: 422 }),
      ),
      ...makeAuthedHandlers(),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/wallets/w-1/edit')
    const currency = await screen.findByLabelText('Currency')
    await waitFor(() => expect(currency).toBeEnabled())
    await user.selectOptions(currency, 'USD')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "A wallet's currency cannot change once it has transactions.",
    )
    await waitFor(() => expect(screen.getByLabelText('Currency')).toBeDisabled())
  })

  it('adjusts the balance showing before, after and the recorded difference', async () => {
    let body: unknown
    server.use(
      noTxns,
      http.put(`${W}/w-1/balance`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ ...cash, balance: '300000' })
      }),
      ...makeAuthedHandlers(),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/wallets/w-1/edit')
    const section = (await screen.findByRole('heading', { name: 'Adjust balance' })).closest(
      'section',
    ) as HTMLElement
    expect(within(section).getByText(/recorded as an adjustment/)).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: /Set balance/ })).toBeDisabled()
    for (const k of ['3', '0', '0', '0', '0', '0']) await user.click(key(section, k))
    const preview = within(section).getByTestId('adjust-preview')
    expect(preview).toHaveTextContent('IDR 250,000') // before
    expect(preview).toHaveTextContent('IDR 300,000') // after
    expect(preview).toHaveTextContent('+IDR 50,000') // adjustment
    await user.click(within(section).getByRole('button', { name: /Set balance to IDR\s300,000/ }))
    await waitFor(() => expect(body).toEqual({ newBalance: '300000' }))
  })
})

describe('card style editor', () => {
  beforeEach(() =>
    server.use(
      http.get(`${W}/w-2`, () => HttpResponse.json(bank)),
      http.get(`${BASE}/wallet-card-presets`, () => HttpResponse.json(presets)),
      http.get(`${BASE}/wallet-card-templates`, () => HttpResponse.json(templates)),
    ),
  )

  const cardBg = () => (document.querySelector('[data-tone]') as HTMLElement).style.background

  it('changes only the draft until Apply, then saves exactly once', async () => {
    const patches: unknown[] = []
    server.use(
      http.patch(`${W}/w-2`, async ({ request }) => {
        patches.push(await request.json())
        return HttpResponse.json(bank)
      }),
      noTxns,
      ...makeAuthedHandlers(),
    )
    const user = userEvent.setup()
    const { router } = renderApp('/s/s-1/wallets/w-2/card')
    await screen.findByRole('radiogroup', { name: 'Card style type' })
    expect(cardBg()).toContain('135deg')

    await user.click(screen.getByRole('button', { name: 'Direction W' }))
    expect(cardBg()).toContain('270deg') // live preview on the real card
    await user.click(screen.getByRole('button', { name: 'Direction NE' }))
    expect(cardBg()).toContain('45deg')
    expect(patches).toEqual([]) // nothing saved yet

    await user.click(screen.getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(patches).toHaveLength(1))
    expect(patches[0]).toMatchObject({ cardStyle: { mode: 'GRADIENT', direction: 'NE' } })
    await waitFor(() => expect(router.state.location.pathname).toBe('/s/s-1/wallets/w-2'))
  })

  it('discards the draft on Cancel', async () => {
    const patch = vi.fn()
    server.use(
      http.patch(`${W}/w-2`, () => {
        patch()
        return HttpResponse.json(bank)
      }),
      noTxns,
      ...makeAuthedHandlers(),
    )
    const user = userEvent.setup()
    const { router } = renderApp('/s/s-1/wallets/w-2/card')
    await screen.findByRole('radiogroup', { name: 'Card style type' })
    await user.click(screen.getByRole('button', { name: 'Direction N' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/s/s-1/wallets/w-2'))
    expect(patch).not.toHaveBeenCalled()
  })

  it('swaps gradient colours and applies a preset', async () => {
    const patches: Array<{
      cardStyle: { colors: string[]; direction: string; presetId: string | null }
    }> = []
    server.use(
      http.patch(`${W}/w-2`, async ({ request }) => {
        patches.push((await request.json()) as never)
        return HttpResponse.json(bank)
      }),
      noTxns,
      ...makeAuthedHandlers(),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/wallets/w-2/card')
    await screen.findByRole('radiogroup', { name: 'Card style type' })
    const before = cardBg()
    await user.click(screen.getByRole('button', { name: 'Swap colours' }))
    expect(cardBg()).not.toBe(before)
    await user.click(await screen.findByRole('button', { name: 'Ocean' }))
    expect(cardBg()).toContain('90deg') // Ocean flows east
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(patches).toHaveLength(1))
    expect(patches[0]?.cardStyle).toMatchObject({ direction: 'E', presetId: 'ocean' })
    expect(patches[0]?.cardStyle.colors).toHaveLength(2)
  })

  it('switches to a solid colour and a template with the right payloads', async () => {
    const patches: unknown[] = []
    server.use(
      http.patch(`${W}/w-2`, async ({ request }) => {
        patches.push(await request.json())
        return HttpResponse.json(bank)
      }),
      noTxns,
      ...makeAuthedHandlers(),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/wallets/w-2/card')
    await screen.findByRole('radiogroup', { name: 'Card style type' })

    await user.click(screen.getByRole('radio', { name: 'Solid' }))
    await user.type(screen.getByLabelText('Custom hex colour'), '#123456')
    expect(cardBg()).toContain('rgb(18, 52, 86)')

    await user.click(screen.getByRole('radio', { name: 'Template' }))
    await user.click(await screen.findByRole('button', { name: 'Template Marble' }))
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(patches).toHaveLength(1))
    expect(patches[0]).toEqual({ cardStyle: { mode: 'TEMPLATE', templateId: 'marble' } })
  })
})
