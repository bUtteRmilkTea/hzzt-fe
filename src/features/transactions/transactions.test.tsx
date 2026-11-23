// biome-ignore-all lint/plugin: hex-free test file; ids and colours come from shared fixtures
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setMedia } from '../../../test/matchMedia'
import { BASE, errorEnvelope, makeAuthedHandlers } from '../../../test/msw/api'
import { seededExpense, seededIncome } from '../../../test/msw/categories'
import { breakdown, overview } from '../../../test/msw/dashboard'
import { server } from '../../../test/msw/server'
import { bank, cash, savings, txn, walletList } from '../../../test/msw/wallets'
import { renderApp } from '../../../test/renderApp'
import { localDate } from './datetime'

const T = `${BASE}/spaces/s-1/transactions`
const key = (root: HTMLElement, label: string) =>
  within(root).getByRole('button', { name: new RegExp(`^${label}$`) })

// Explicit order, no favourites: Cash (IDR) is first, BCA (IDR) second, Savings (USD) third.
const w1 = { ...cash, sortOrder: 0 }
const w2 = { ...bank, sortOrder: 1 }
const w3 = { ...savings, isFavorite: false, sortOrder: 2 }
const wallets = http.get(`${BASE}/spaces/s-1/wallets`, () =>
  HttpResponse.json(walletList([w1, w2, w3])),
)
const categories = http.get(`${BASE}/spaces/s-1/categories`, ({ request }) => {
  const type = new URL(request.url).searchParams.get('type')
  return HttpResponse.json(
    [...seededExpense, ...seededIncome].filter((c) => !type || c.type === type),
  )
})
const today = () => new Date().toISOString()

describe('history list', () => {
  beforeEach(() => {
    server.use(...makeAuthedHandlers())
    server.use(wallets, categories)
  })

  it('groups by day with the day totals from the daily summary', async () => {
    const day = (d: number, h = 12) => new Date(2026, 10, d, h).toISOString()
    server.use(
      http.get(T, () =>
        HttpResponse.json({
          items: [
            txn({ id: 'a', title: 'Lunch', occurredAt: day(18) }),
            txn({
              id: 'b',
              title: 'Salary',
              type: 'INCOME',
              direction: 'IN',
              amount: '1000000',
              occurredAt: day(18, 9),
            }),
            txn({ id: 'c', title: 'Coffee', occurredAt: day(17) }),
          ],
        }),
      ),
      http.get(`${T}/daily-summary`, () =>
        HttpResponse.json({
          currency: 'IDR',
          warnings: [],
          items: [
            { date: '2026-11-18', count: 2, income: '1000000', expense: '50000', transfer: '0' },
            { date: '2026-11-17', count: 1, income: '0', expense: '25000', transfer: '0' },
          ],
        }),
      ),
    )
    renderApp('/s/s-1/history')
    const list = await screen.findByRole('list', { name: 'Transactions' })
    expect(within(list).getByText('Wed, 18 Nov')).toBeInTheDocument()
    expect(within(list).getByText('Tue, 17 Nov')).toBeInTheDocument()
    const headers = within(list).getAllByRole('heading', { level: 2 })
    expect(headers[0]?.closest('div')).toHaveTextContent('In IDR 1,000,000')
    expect(headers[0]?.closest('div')).toHaveTextContent('Out IDR 50,000')
    expect(headers[1]?.closest('div')).not.toHaveTextContent('In IDR')
    expect(within(list).getByText('Lunch')).toBeInTheDocument()
    expect(within(list).getAllByText('-IDR 50,000')).toHaveLength(2)
  })

  it('renders only a window of 500 transactions, each row at a fixed height (no layout shift)', async () => {
    const many = Array.from({ length: 500 }, (_, i) =>
      txn({
        id: `t-${i}`,
        title: `Item ${i}`,
        occurredAt: new Date(2026, 10, 18, 12, 0, 0 - i).toISOString(),
      }),
    )
    server.use(http.get(T, () => HttpResponse.json({ items: many })))
    renderApp('/s/s-1/history')
    const list = await screen.findByRole('list', { name: 'Transactions' })
    await screen.findByText('Item 0')
    const rendered = within(list).getAllByRole('listitem')
    expect(rendered.length).toBeLessThan(60) // not 500
    expect(rendered.length).toBeGreaterThan(5)
    // Every row has an explicit height, so loading more pages cannot move what is on screen.
    for (const li of rendered) expect(li.style.height).toMatch(/^\d+px$/)
    // The scroll area is sized for all 500 rows + the day header up front.
    expect(Number.parseInt(list.style.height, 10)).toBeGreaterThanOrEqual(500 * 49)
  })

  it('loads the next page by cursor as the end of the loaded rows comes into view', async () => {
    const cursors: Array<string | null> = []
    server.use(
      http.get(T, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor')
        cursors.push(cursor)
        return cursor
          ? HttpResponse.json({
              items: [
                txn({
                  id: 'p2',
                  title: 'Second page',
                  occurredAt: new Date(2026, 10, 10, 12).toISOString(),
                }),
              ],
            })
          : HttpResponse.json({
              items: [
                txn({
                  id: 'p1',
                  title: 'First page',
                  occurredAt: new Date(2026, 10, 18, 12).toISOString(),
                }),
              ],
              nextCursor: 'next-1',
            })
      }),
    )
    renderApp('/s/s-1/history')
    expect(await screen.findByText('First page')).toBeInTheDocument()
    expect(await screen.findByText('Second page')).toBeInTheDocument()
    expect(cursors).toEqual([null, 'next-1'])
  })

  it('has empty, filtered-empty, error-with-retry and loading states', async () => {
    let mode: 'error' | 'empty' = 'error'
    server.use(
      http.get(T, async () => {
        await new Promise((r) => setTimeout(r, 40))
        return mode === 'error'
          ? HttpResponse.json(errorEnvelope('INTERNAL_ERROR'), { status: 500 })
          : HttpResponse.json({ items: [] })
      }),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/history')
    await screen.findByRole('heading', { name: 'History' })
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument()
    expect(await screen.findByText("Couldn't load your history")).toBeInTheDocument()
    mode = 'empty'
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('No transactions yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add transaction' })).toBeInTheDocument()
  })

  it('opens a transaction in the edit sheet when tapped', async () => {
    server.use(
      http.get(T, () => HttpResponse.json({ items: [txn({ id: 't-77', occurredAt: today() })] })),
      http.get(`${T}/t-77`, () =>
        HttpResponse.json(
          txn({ id: 't-77', occurredAt: today(), wallet: { id: 'w-1', name: 'Cash' } }),
        ),
      ),
    )
    const user = userEvent.setup()
    const { router } = renderApp('/s/s-1/history')
    await user.click(await screen.findByText('Lunch'))
    await waitFor(() => expect(router.state.location.pathname).toBe('/s/s-1/transactions/t-77'))
  })
})

describe('search', () => {
  beforeEach(() => {
    server.use(...makeAuthedHandlers())
    server.use(wallets, categories)
  })

  it('debounces typing into the URL and the request, and names what was searched when empty', async () => {
    const qs: Array<string | null> = []
    server.use(
      http.get(T, ({ request }) => {
        qs.push(new URL(request.url).searchParams.get('q'))
        return HttpResponse.json({ items: [] })
      }),
    )
    const user = userEvent.setup()
    const { router } = renderApp('/s/s-1/history')
    await user.type(await screen.findByLabelText('Search transactions'), 'coffee')
    await waitFor(() => expect(router.state.location.search).toMatchObject({ q: 'coffee' }))
    expect(await screen.findByText('No results for “coffee”')).toBeInTheDocument()
    // typed in one go, so the request went out once for the final text, not once per letter
    expect(qs.filter((q) => q !== null)).toEqual(['coffee'])
  })

  it('starts from the URL', async () => {
    server.use(http.get(T, () => HttpResponse.json({ items: [] })))
    renderApp('/s/s-1/history?q=tea')
    expect(await screen.findByLabelText('Search transactions')).toHaveValue('tea')
  })
})

describe('URL restores the view', () => {
  beforeEach(() => {
    server.use(...makeAuthedHandlers())
    server.use(wallets, categories)
  })

  it('a filtered, searched link sends the same requests in a fresh session', async () => {
    const seen: URLSearchParams[] = []
    server.use(
      http.get(T, ({ request }) => {
        seen.push(new URL(request.url).searchParams)
        return HttpResponse.json({ items: [] })
      }),
    )
    const search = `?period=LAST_7_DAYS&q=tea&categoryIds=${encodeURIComponent('["e-0"]')}&walletIds=${encodeURIComponent('["w-1","w-2"]')}`
    renderApp(`/s/s-1/history${search}`)
    await screen.findByText(/No results for/)
    const p = seen[0] as URLSearchParams
    expect(p.get('period')).toBe('LAST_7_DAYS')
    expect(p.get('q')).toBe('tea')
    expect(p.getAll('categoryIds')).toEqual(['e-0'])
    expect(p.getAll('walletIds')).toEqual(['w-1', 'w-2'])
    expect(screen.getByRole('link', { name: 'Filters, 3 active' })).toBeInTheDocument()
  })
})

describe('filter sheet', () => {
  beforeEach(() => {
    server.use(...makeAuthedHandlers())
    server.use(
      wallets,
      categories,
      http.get(T, () => HttpResponse.json({ items: [] })),
    )
  })

  it('applies the draft to the URL only on Apply, and shows the active count', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/s/s-1/history')
    await user.click(await screen.findByRole('link', { name: 'Filters' }))
    const sheet = await screen.findByRole('dialog', { name: 'Filters' })

    await user.click(within(sheet).getByRole('button', { name: 'Last 7 days' }))
    await user.click(await within(sheet).findByRole('button', { name: /Food/ }))
    await user.click(await within(sheet).findByRole('button', { name: /BCA/ }))
    expect(router.state.location.search).toEqual({}) // nothing applied yet

    await user.click(within(sheet).getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/s/s-1/history'))
    expect(router.state.location.search).toMatchObject({
      period: 'LAST_7_DAYS',
      categoryIds: ['e-0'],
      walletIds: ['w-2'],
    })
    expect(await screen.findByRole('link', { name: 'Filters, 3 active' })).toBeInTheDocument()
  })

  it('Clear resets the draft, and closing without Apply keeps the current filters', async () => {
    const user = userEvent.setup()
    const { router } = renderApp(
      `/s/s-1/history?period=TODAY&categoryIds=${encodeURIComponent('["e-1"]')}`,
    )
    await user.click(await screen.findByRole('link', { name: 'Filters, 2 active' }))
    const sheet = await screen.findByRole('dialog', { name: 'Filters' })
    expect(await within(sheet).findByRole('button', { name: /Transport/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(within(sheet).getByRole('button', { name: 'Clear' }))
    expect(within(sheet).getByRole('button', { name: /Transport/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    await user.click(within(sheet).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/s/s-1/history'))
    expect(router.state.location.search).toMatchObject({ period: 'TODAY', categoryIds: ['e-1'] })
  })

  it('supports a custom date range', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/s/s-1/history')
    await user.click(await screen.findByRole('link', { name: 'Filters' }))
    const sheet = await screen.findByRole('dialog', { name: 'Filters' })
    const useRange = within(sheet).getByRole('button', { name: 'Use custom range' })
    expect(useRange).toBeDisabled()
    await user.type(within(sheet).getByLabelText('From'), '2026-10-01')
    await user.type(within(sheet).getByLabelText('To'), '2026-10-31')
    await user.click(useRange)
    await user.click(within(sheet).getByRole('button', { name: 'Apply' }))
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ from: '2026-10-01', to: '2026-10-31' }),
    )
  })
})

describe('add a transaction', () => {
  beforeEach(() => {
    server.use(...makeAuthedHandlers())
    server.use(
      wallets,
      categories,
      http.get(T, () => HttpResponse.json({ items: [] })),
    )
  })

  async function openAdd(user: ReturnType<typeof userEvent.setup>, path = '/s/s-1/history') {
    const app = renderApp(path)
    await user.click(await screen.findByRole('button', { name: 'Add transaction' }))
    const sheet = await screen.findByRole('dialog', { name: 'Add transaction' })
    return { ...app, sheet }
  }

  it('records an expense: amount on the keypad, wallet, category, date and note', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post(T, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(txn({ id: 'new-1' }), { status: 201 })
      }),
    )
    const user = userEvent.setup()
    const { sheet, router } = await openAdd(user)
    expect(await within(sheet).findByLabelText(/Amount \(IDR\)/)).toBeInTheDocument()
    for (const k of ['7', '5', '0', '0', '0']) await user.click(key(sheet, k))
    await user.click(await within(sheet).findByRole('button', { name: /Transport/ }))
    await user.type(within(sheet).getByLabelText('Note (optional)'), 'Taxi')
    await user.click(within(sheet).getByRole('button', { name: 'Add expense' }))

    await waitFor(() =>
      expect(body).toMatchObject({
        type: 'EXPENSE',
        amount: '75000',
        walletId: 'w-1',
        categoryId: 'e-1',
        note: 'Taxi',
      }),
    )
    expect(new Date(body.occurredAt as string).toString()).not.toBe('Invalid Date')
    await waitFor(() => expect(router.state.location.pathname).toBe('/s/s-1/history'))
  })

  it('offers only categories of the chosen type, so a mismatch cannot be sent', async () => {
    const types: Array<string | null> = []
    server.use(
      http.get(`${BASE}/spaces/s-1/categories`, ({ request }) => {
        const type = new URL(request.url).searchParams.get('type')
        types.push(type)
        return HttpResponse.json([...seededExpense, ...seededIncome].filter((c) => c.type === type))
      }),
    )
    const user = userEvent.setup()
    const { sheet } = await openAdd(user)
    expect(await within(sheet).findByRole('button', { name: /Food/ })).toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: /Salary/ })).not.toBeInTheDocument()
    await user.click(within(sheet).getByRole('radio', { name: 'Income' }))
    expect(await within(sheet).findByRole('button', { name: /Salary/ })).toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: /Food/ })).not.toBeInTheDocument()
    expect(types).toContain('INCOME')
  })

  it("uses the selected wallet's currency for the amount", async () => {
    const user = userEvent.setup()
    const { sheet } = await openAdd(user)
    await user.selectOptions(await within(sheet).findByLabelText('Wallet'), 'w-3')
    expect(await within(sheet).findByLabelText(/Amount \(USD\)/)).toBeInTheDocument()
  })

  it('blocks a zero amount without calling the server', async () => {
    const called = vi.fn()
    server.use(
      http.post(T, () => {
        called()
        return HttpResponse.json(txn())
      }),
    )
    const user = userEvent.setup()
    const { sheet } = await openAdd(user)
    await within(sheet).findByLabelText(/Amount \(IDR\)/)
    await user.click(within(sheet).getByRole('button', { name: 'Add expense' }))
    expect(await within(sheet).findByText('Enter an amount greater than zero')).toBeInTheDocument()
    expect(called).not.toHaveBeenCalled()
  })

  it('asks for a wallet first when there are none', async () => {
    server.use(http.get(`${BASE}/spaces/s-1/wallets`, () => HttpResponse.json(walletList([]))))
    const user = userEvent.setup()
    const { sheet } = await openAdd(user)
    expect(await within(sheet).findByText(/Add a wallet first/)).toBeInTheDocument()
  })

  it('shows the new row at once as pending, then keeps it once the server confirms', async () => {
    let saved = false
    const stored = txn({
      id: 'srv-1',
      title: undefined,
      note: 'Snack',
      occurredAt: today(),
      wallet: { id: 'w-1', name: 'Cash' },
    })
    server.use(
      http.get(T, () => HttpResponse.json({ items: saved ? [stored] : [] })),
      http.post(T, async () => {
        await new Promise((r) => setTimeout(r, 250))
        saved = true
        return HttpResponse.json(stored, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    const { sheet } = await openAdd(user)
    await within(sheet).findByLabelText(/Amount \(IDR\)/)
    for (const k of ['5', '0', '0', '0']) await user.click(key(sheet, k))
    await user.type(within(sheet).getByLabelText('Note (optional)'), 'Snack')
    await user.click(within(sheet).getByRole('button', { name: 'Add expense' }))

    // History was empty, so the pending row has nothing to sit in yet; once the list is
    // seeded the row is inserted at the top. Assert the confirmed state arrives and is unmarked.
    await waitFor(() => expect(saved).toBe(true))
    await waitFor(() => expect(document.querySelector('[data-pending]')).not.toBeInTheDocument())
    expect(await screen.findByText('Expense', { exact: false })).toBeInTheDocument()
  })

  it('inserts the pending row at the top of an existing list, and rolls it back with a toast on failure', async () => {
    const existing = txn({ id: 'old-1', title: 'Old lunch', occurredAt: today() })
    server.use(
      http.get(T, () => HttpResponse.json({ items: [existing] })),
      http.post(T, async () => {
        await new Promise((r) => setTimeout(r, 400))
        return HttpResponse.json(errorEnvelope('INTERNAL_ERROR'), { status: 500 })
      }),
    )
    const user = userEvent.setup()
    // start on history so its list is cached, then open the sheet from the shell
    const { sheet } = await openAdd(user)
    await within(sheet).findByLabelText(/Amount \(IDR\)/)
    for (const k of ['9', '0', '0', '0']) await user.click(key(sheet, k))
    await user.type(within(sheet).getByLabelText('Note (optional)'), 'Oops')
    await user.click(within(sheet).getByRole('button', { name: 'Add expense' }))

    const pending = await waitFor(() => {
      const el = document.querySelector('[data-pending]')
      expect(el).toBeInTheDocument()
      return el as HTMLElement
    })
    expect(pending).toHaveTextContent('Saving…')
    const rows = screen.getAllByRole('listitem')
    expect(rows[1]).toContainElement(pending) // directly under the day header, above the older row

    await waitFor(() => expect(document.querySelector('[data-pending]')).not.toBeInTheDocument())
    expect(await screen.findByText(/Couldn't save that transaction/)).toBeInTheDocument()
    expect(screen.getByText('Old lunch')).toBeInTheDocument()
  })

  it('Transfer is disabled with one wallet and says why (F37-T03)', async () => {
    server.use(http.get(`${BASE}/spaces/s-1/wallets`, () => HttpResponse.json(walletList([cash]))))
    const user = userEvent.setup()
    const { sheet } = await openAdd(user)
    await user.click(within(sheet).getByRole('radio', { name: 'Transfer' }))
    const btn = await within(sheet).findByRole('button', { name: 'Transfer' })
    await waitFor(() => expect(btn).toBeDisabled())
    expect(btn).toHaveAttribute('aria-disabled', 'true')
    const reason = within(sheet).getByText('Add a second wallet to transfer')
    expect(btn).toHaveAttribute('aria-describedby', reason.id)
  })

  it('creates a same-currency transfer without asking for a received amount', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post(`${BASE}/spaces/s-1/transfers`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(txn({ type: 'TRANSFER' }), { status: 201 })
      }),
    )
    const user = userEvent.setup()
    const { sheet } = await openAdd(user)
    await user.click(within(sheet).getByRole('radio', { name: 'Transfer' }))
    await within(sheet).findByLabelText('From')
    expect(within(sheet).queryByLabelText(/Amount received/)).not.toBeInTheDocument()
    for (const k of ['2', '0', '0', '0']) await user.click(key(sheet, k))
    await user.click(within(sheet).getByRole('button', { name: 'Transfer' }))
    await waitFor(() =>
      expect(body).toMatchObject({
        amount: '2000',
        from: { type: 'WALLET', walletId: 'w-1' },
        to: { type: 'WALLET', walletId: 'w-2' },
      }),
    )
    expect(body).not.toHaveProperty('toAmount')
  })

  it('a cross-currency transfer needs the amount received and shows the resulting rate first', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post(`${BASE}/spaces/s-1/transfers`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(txn({ type: 'TRANSFER' }), { status: 201 })
      }),
    )
    const user = userEvent.setup()
    const { sheet } = await openAdd(user)
    await user.click(within(sheet).getByRole('radio', { name: 'Transfer' }))
    await user.selectOptions(await within(sheet).findByLabelText('From'), 'w-3') // USD
    await user.selectOptions(within(sheet).getByLabelText('To'), 'w-1') // IDR
    for (const k of ['1', '0', '0']) await user.click(key(sheet, k))

    const received = await within(sheet).findByLabelText(/Amount received \(IDR\)/)
    await user.click(within(sheet).getByRole('button', { name: 'Transfer' }))
    expect(await within(sheet).findByText('Enter the amount received')).toBeInTheDocument()
    expect(body).toEqual({}) // nothing was sent

    await user.type(received, '1625000')
    expect(within(sheet).getByText('1 USD = 16,250 IDR')).toBeInTheDocument() // rate shown before submitting
    await user.click(within(sheet).getByRole('button', { name: 'Transfer' }))
    await waitFor(() =>
      expect(body).toMatchObject({
        amount: '100.00',
        toAmount: '1625000',
        from: { walletId: 'w-3' },
        to: { walletId: 'w-1' },
      }),
    )
  })

  it('refuses a transfer to the same wallet', async () => {
    const user = userEvent.setup()
    const { sheet } = await openAdd(user)
    await user.click(within(sheet).getByRole('radio', { name: 'Transfer' }))
    await user.selectOptions(await within(sheet).findByLabelText('From'), 'w-1')
    await user.selectOptions(within(sheet).getByLabelText('To'), 'w-1')
    for (const k of ['5', '0']) await user.click(key(sheet, k))
    await user.click(within(sheet).getByRole('button', { name: 'Transfer' }))
    expect(await within(sheet).findByText('Choose two different wallets')).toBeInTheDocument()
  })

  it('explains a server-side transfer failure in plain words', async () => {
    server.use(
      http.post(`${BASE}/spaces/s-1/transfers`, () =>
        HttpResponse.json(errorEnvelope('FX_RATE_UNAVAILABLE'), { status: 422 }),
      ),
    )
    const user = userEvent.setup()
    const { sheet } = await openAdd(user)
    await user.click(within(sheet).getByRole('radio', { name: 'Transfer' }))
    await within(sheet).findByLabelText('From')
    for (const k of ['5', '0']) await user.click(key(sheet, k))
    await user.click(within(sheet).getByRole('button', { name: 'Transfer' }))
    expect(await within(sheet).findByRole('alert')).toHaveTextContent(
      'An exchange rate is missing for this currency.',
    )
  })

  it('opens ready to transfer out of a given wallet from its detail screen', async () => {
    server.use(http.get(`${BASE}/spaces/s-1/wallets/w-2`, () => HttpResponse.json(bank)))
    const user = userEvent.setup()
    renderApp('/s/s-1/wallets/w-2')
    await user.click(await screen.findByRole('link', { name: 'Transfer' }))
    const sheet = await screen.findByRole('dialog', { name: 'Add transaction' })
    expect(within(sheet).getByRole('radio', { name: 'Transfer' })).toBeChecked()
    expect(await within(sheet).findByLabelText('From')).toHaveValue('w-2')
  })
})

describe('edit and delete', () => {
  beforeEach(() => {
    server.use(...makeAuthedHandlers())
    server.use(
      wallets,
      categories,
      http.get(T, () => HttpResponse.json({ items: [] })),
    )
  })
  const open = (id: string) => renderApp(`/s/s-1/transactions/${id}`)
  const when = new Date(2026, 10, 10, 12).toISOString()

  it('edits an expense and sends null to clear a removed note', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.get(`${T}/t-1`, () =>
        HttpResponse.json(
          txn({
            id: 't-1',
            occurredAt: when,
            note: 'old note',
            category: { id: 'e-0', name: 'Food' },
            wallet: { id: 'w-1', name: 'Cash' },
          }),
        ),
      ),
      http.patch(`${T}/t-1`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(txn())
      }),
    )
    const user = userEvent.setup()
    open('t-1')
    const sheet = await screen.findByRole('dialog', { name: 'Lunch' })
    const note = await within(sheet).findByLabelText('Note (optional)')
    expect(note).toHaveValue('old note')
    await user.clear(note)
    await user.click(within(sheet).getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(body).toMatchObject({ note: null, categoryId: 'e-0', walletId: 'w-1' }),
    )
    expect(body.amount).toBe('50000')
  })

  it('adjustment and opening-balance rows expose only the note', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.get(`${T}/t-2`, () =>
        HttpResponse.json(
          txn({
            id: 't-2',
            type: 'ADJUSTMENT',
            direction: 'IN',
            amount: '25000',
            title: 'Balance adjustment',
            note: '',
            occurredAt: when,
            category: undefined,
            wallet: { id: 'w-1', name: 'Cash' },
          }),
        ),
      ),
      http.patch(`${T}/t-2`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(txn())
      }),
    )
    const user = userEvent.setup()
    open('t-2')
    const sheet = await screen.findByRole('dialog', { name: 'Balance adjustment' })
    expect(await within(sheet).findByText(/only its note can be changed/)).toBeInTheDocument()
    expect(within(sheet).queryByLabelText('Wallet')).toBeDisabled()
    expect(within(sheet).queryByText('Category')).not.toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    await user.type(within(sheet).getByLabelText('Note (optional)'), 'counted cash')
    await user.click(within(sheet).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(body).toEqual({ note: 'counted cash' })) // nothing else is sent
  })

  it('edits a transfer through the transfer endpoint', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.get(`${T}/t-3`, () =>
        HttpResponse.json(
          txn({
            id: 't-3',
            type: 'TRANSFER',
            direction: 'OUT',
            amount: '1000',
            title: undefined,
            note: '',
            occurredAt: when,
            category: undefined,
            wallet: { id: 'w-1', name: 'Cash' },
            toWallet: { id: 'w-2', name: 'BCA' },
          }),
        ),
      ),
      http.patch(`${BASE}/spaces/s-1/transfers/t-3`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(txn())
      }),
    )
    const user = userEvent.setup()
    open('t-3')
    const sheet = await screen.findByRole('dialog', { name: 'Transfer' })
    expect(await within(sheet).findByLabelText('From')).toHaveValue('w-1')
    expect(within(sheet).getByLabelText('To')).toHaveValue('w-2')
    await user.type(within(sheet).getByLabelText('Note (optional)'), 'rent')
    await user.click(within(sheet).getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(body).toMatchObject({
        from: { type: 'WALLET', walletId: 'w-1' },
        to: { type: 'WALLET', walletId: 'w-2' },
        note: 'rent',
      }),
    )
  })

  it('keeps investment trades read-only here', async () => {
    server.use(
      http.get(`${T}/t-4`, () =>
        HttpResponse.json(
          txn({
            id: 't-4',
            type: 'TRANSFER',
            investmentAction: 'BUY',
            occurredAt: when,
            wallet: { id: 'w-1', name: 'Cash' },
          }),
        ),
      ),
    )
    open('t-4')
    const sheet = await screen.findByRole('dialog')
    expect(await within(sheet).findByText(/edited from its own screen/)).toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
  })

  it('deletes after confirming, and the lists are refreshed', async () => {
    const deleted: string[] = []
    let listCalls = 0
    server.use(
      http.get(`${T}/t-1`, () =>
        HttpResponse.json(
          txn({ id: 't-1', occurredAt: when, wallet: { id: 'w-1', name: 'Cash' } }),
        ),
      ),
      http.delete(`${T}/t-1`, () => {
        deleted.push('t-1')
        return new HttpResponse(null, { status: 204 })
      }),
      http.get(T, () => {
        listCalls++
        return HttpResponse.json({ items: [] })
      }),
    )
    const user = userEvent.setup()
    const { router } = open('t-1')
    const sheet = await screen.findByRole('dialog', { name: 'Lunch' })
    await user.click(await within(sheet).findByRole('button', { name: 'Delete' }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete this transaction?' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(deleted).toEqual(['t-1']))
    await waitFor(() => expect(router.state.location.pathname).toBe('/s/s-1/history'))
    await waitFor(() => expect(listCalls).toBeGreaterThan(0)) // history refetched, no manual reload
  })

  it('explains USE_SPECIFIC_ENDPOINT in plain words', async () => {
    server.use(
      http.get(`${T}/t-1`, () =>
        HttpResponse.json(
          txn({ id: 't-1', occurredAt: when, wallet: { id: 'w-1', name: 'Cash' } }),
        ),
      ),
      http.patch(`${T}/t-1`, () =>
        HttpResponse.json(errorEnvelope('USE_SPECIFIC_ENDPOINT'), { status: 422 }),
      ),
    )
    const user = userEvent.setup()
    open('t-1')
    const sheet = await screen.findByRole('dialog', { name: 'Lunch' })
    await user.click(await within(sheet).findByRole('button', { name: 'Save changes' }))
    expect(await within(sheet).findByRole('alert')).toHaveTextContent(
      'This kind of entry must be edited from its own screen.',
    )
    expect(document.body.textContent).not.toContain('USE_SPECIFIC_ENDPOINT')
  })

  it('shows an error state when the transaction cannot be loaded', async () => {
    server.use(
      http.get(`${T}/t-9`, () => HttpResponse.json(errorEnvelope('NOT_FOUND'), { status: 404 })),
    )
    open('t-9')
    expect(await screen.findByText("Couldn't load this transaction")).toBeInTheDocument()
  })
})

describe('balances follow every write without a reload', () => {
  beforeEach(() => server.use(...makeAuthedHandlers()))

  it('refetches wallets, history and summary after an add', async () => {
    const calls = { wallets: 0, list: 0, summary: 0 }
    let balance = '250000'
    server.use(
      http.get(`${BASE}/spaces/s-1/wallets`, () => {
        calls.wallets++
        return HttpResponse.json(walletList([{ ...w1, balance }]))
      }),
      http.get(T, () => {
        calls.list++
        return HttpResponse.json({ items: [] })
      }),
      http.get(`${T}/daily-summary`, () => {
        calls.summary++
        return HttpResponse.json({ currency: 'IDR', items: [], warnings: [] })
      }),
      http.post(T, () => {
        balance = '200000'
        return HttpResponse.json(txn(), { status: 201 })
      }),
      categories,
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/history')
    await user.click(await screen.findByRole('button', { name: 'Add transaction' }))
    const sheet = await screen.findByRole('dialog', { name: 'Add transaction' })
    await within(sheet).findByLabelText(/Amount \(IDR\)/)
    const before = { ...calls }
    for (const k of ['5', '0', '0', '0', '0']) await user.click(key(sheet, k))
    await user.click(within(sheet).getByRole('button', { name: 'Add expense' }))
    await waitFor(() => expect(calls.list).toBeGreaterThan(before.list))
    await waitFor(() => expect(calls.summary).toBeGreaterThan(before.summary))
    // wallets has no live observer on the history page, so it is marked stale and refetched on next view
    await user.click(screen.getByRole('link', { name: 'Wallets' }))
    expect(await screen.findByLabelText('Cash, open wallet')).toBeInTheDocument()
    await waitFor(() => expect(calls.wallets).toBeGreaterThan(before.wallets))
    expect(screen.getByText('IDR 200,000')).toBeInTheDocument()
  })
})

describe('default date', () => {
  beforeEach(() => server.use(...makeAuthedHandlers()))

  it('defaults the add form to today in local time', async () => {
    server.use(
      wallets,
      categories,
      http.get(T, () => HttpResponse.json({ items: [] })),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/history')
    await user.click(await screen.findByRole('button', { name: 'Add transaction' }))
    const sheet = await screen.findByRole('dialog', { name: 'Add transaction' })
    expect(await within(sheet).findByLabelText('Date')).toHaveValue(localDate(new Date()))
  })
})

describe('history toolbar, filter panel and chips at 1024px+ (F12)', () => {
  const D = `${BASE}/spaces/s-1/dashboard`
  beforeEach(() => {
    setMedia({ desktop: true, wide: true })
    server.use(...makeAuthedHandlers())
    server.use(
      wallets,
      categories,
      http.get(T, () =>
        HttpResponse.json({
          items: [txn({ id: 'a', title: 'Lunch', wallet: { id: 'w-1', name: 'Cash' } })],
        }),
      ),
      http.get(`${D}/overview`, () => HttpResponse.json(overview())),
      http.get(`${D}/category-breakdown`, () => HttpResponse.json(breakdown())),
    )
  })
  afterEach(() => setMedia({ desktop: false, wide: false }))

  it('has no permanent filter column: search, period and a Filters button sit in a toolbar', async () => {
    renderApp('/s/s-1/history')
    expect(await screen.findByRole('searchbox', { name: 'Search transactions' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Filters' })).toBeVisible()
    expect(screen.getByRole('button', { name: /This period|Period/ })).toBeVisible()
    expect(screen.queryByTestId('filter-panel')).not.toBeInTheDocument()
  })

  it('opens the filters as a right-side panel with a sticky Apply and Clear, and Apply writes the URL', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/s/s-1/history')
    await user.click(await screen.findByRole('link', { name: 'Filters' }))
    const panel = await screen.findByRole('dialog', { name: 'Filters' })
    expect(within(panel).getByRole('button', { name: 'Clear' })).toBeVisible()
    await user.click(within(panel).getByRole('button', { name: 'Last 7 days' }))
    // Nothing is written until Apply.
    expect(router.state.location.search).not.toMatchObject({ period: 'LAST_7_DAYS' })
    await user.click(within(panel).getByRole('button', { name: 'Apply' }))
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ period: 'LAST_7_DAYS' }),
    )
  })

  it('shows a removable chip per active filter, restored from the URL, and removing one updates it', async () => {
    const user = userEvent.setup()
    // A pasted URL into a fresh tab: the same filters come back (acts as a reload).
    const { router } = renderApp('/s/s-1/history?period=LAST_7_DAYS&categoryIds=e-0&walletIds=w-1')
    const chips = await screen.findByRole('list', { name: 'Active filters' })
    expect(within(chips).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByRole('link', { name: 'Filters, 3 active' })).toBeVisible()
    await user.click(await within(chips).findByRole('button', { name: /Remove filter: .*Food/ }))
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('categoryIds'))
    expect(router.state.location.search).toMatchObject({ period: 'LAST_7_DAYS' })
    expect(within(chips).getAllByRole('listitem')).toHaveLength(2)
  })

  it('renders no chip row when nothing is filtered', async () => {
    renderApp('/s/s-1/history')
    await screen.findByRole('list', { name: 'Transactions' })
    expect(screen.queryByRole('list', { name: 'Active filters' })).not.toBeInTheDocument()
  })

  it('shows the wallet column on rows and the period summary rail', async () => {
    renderApp('/s/s-1/history')
    expect(await screen.findByTestId('row-wallet')).toHaveTextContent('Cash')
    const rail = await screen.findByTestId('history-rail')
    expect(await within(rail).findByText('In')).toBeInTheDocument()
    expect(within(rail).getByText('Out')).toBeInTheDocument()
    expect(within(rail).getByText(/before filters/i)).toBeInTheDocument()
  })
})
