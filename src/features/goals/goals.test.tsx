// biome-ignore-all lint/plugin: fixtures only
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { BASE, errorEnvelope, makeAuthedHandlers } from '../../../test/msw/api'
import { goal } from '../../../test/msw/assets'
import { server } from '../../../test/msw/server'
import { cash, walletList } from '../../../test/msw/wallets'
import { renderApp } from '../../../test/renderApp'

const G = `${BASE}/spaces/s-1/goals`
const W = `${BASE}/spaces/s-1/wallets`

// A USD wallet of 134.26 with 100 reserved, so 34.26 is available (the plan's example).
const dollars = {
  ...cash,
  id: 'w-5',
  name: 'Dollars',
  icon: '💵',
  currency: 'USD',
  balance: '134.26',
  reserved: '100',
  available: '34.26',
  sortOrder: 0,
}

beforeEach(() => server.use(...makeAuthedHandlers()))

describe('goals list', () => {
  it('shows a progress ring from the server percentage, the target, the date and the monthly need', async () => {
    server.use(http.get(G, () => HttpResponse.json({ items: [goal()] })))
    renderApp('/s/s-1/goals')
    const ring = await screen.findByRole('progressbar', { name: 'Progress' })
    expect(ring).toHaveAttribute('aria-valuenow', '25')
    expect(ring).toHaveAttribute('aria-valuetext', '25%')
    expect(screen.getByText('Holiday')).toBeInTheDocument()
    expect(screen.getByText(/By 1 May 2027/)).toBeInTheDocument()
    expect(screen.getByText(/IDR 1,250,000/)).toBeInTheDocument() // required monthly
    expect(screen.getByText(/IDR 2,500,000/)).toBeInTheDocument()
  })

  it('shows an Achieved state, and not once progress drops below the target again', async () => {
    let achieved = true
    server.use(
      http.get(G, () =>
        HttpResponse.json({
          items: [
            goal({
              progress: achieved ? '10000000' : '9000000',
              progressPct: achieved ? '100.00' : '90.00',
              achievedAt: achieved ? '2026-11-01T00:00:00Z' : undefined,
            }),
          ],
        }),
      ),
    )
    const { queryClient } = renderApp('/s/s-1/goals')
    expect(await screen.findByText('Achieved')).toBeInTheDocument()
    achieved = false
    await queryClient.invalidateQueries({ queryKey: ['space', 's-1', 'goals'] })
    await waitFor(() => expect(screen.queryByText('Achieved')).not.toBeInTheDocument())
    expect(screen.getByRole('progressbar', { name: 'Progress' })).toHaveAttribute(
      'aria-valuenow',
      '90',
    )
  })

  it('shows the empty state with its single Add goal action', async () => {
    renderApp('/s/s-1/goals')
    expect(await screen.findByText('No goals yet')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Add goal/ }).length).toBeGreaterThan(0)
  })

  it('has an error state with a retry, and a loading state', async () => {
    let fail = true
    server.use(
      http.get(G, async () => {
        await new Promise((r) => setTimeout(r, 40))
        return fail
          ? HttpResponse.json(errorEnvelope('INTERNAL_ERROR'), { status: 500 })
          : HttpResponse.json({ items: [goal()] })
      }),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/goals')
    await screen.findByRole('heading', { name: 'Goals' })
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument()
    expect(await screen.findByText("Couldn't load your goals")).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Holiday')).toBeInTheDocument()
  })
})

describe('goals page layout (F36-T02)', () => {
  it('uses a compact grid, a 48px ring and a collapsed Achieved section', async () => {
    server.use(
      http.get(`${BASE}/spaces/s-1/goals`, () =>
        HttpResponse.json({
          items: [
            {
              id: 'g-1',
              name: 'Trip',
              icon: '🎯',
              currency: 'IDR',
              targetAmount: '1000',
              progress: '100',
              progressPct: '10',
            },
            {
              id: 'g-2',
              name: 'Bike',
              icon: '🚲',
              currency: 'IDR',
              targetAmount: '1000',
              progress: '1000',
              progressPct: '100',
              achievedAt: '2026-11-01T00:00:00Z',
            },
          ],
        }),
      ),
      ...makeAuthedHandlers(),
    )
    renderApp('/s/s-1/goals')
    const grids = await screen.findAllByTestId('goals-grid')
    expect(grids[0]?.className).toContain('grid-cols-1')
    expect(grids[0]?.className).toContain('sm:grid-cols-2')
    expect(grids[0]?.className).toContain('xl:grid-cols-3')
    expect(grids[0]?.className).toContain('items-start')
    const toggle = screen.getByRole('button', { name: /Achieved \(1\)/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    const ring = screen.getAllByRole('progressbar', { name: 'Progress' })[0] as HTMLElement
    expect(ring.style.width).toBe('48px')
  })
})

describe('goal form', () => {
  beforeEach(() => server.use(http.get(W, () => HttpResponse.json(walletList([dollars])))))

  it('a wallet of 134.26 with 100 reserved shows 34.26 available in the goal form', async () => {
    const user = userEvent.setup()
    renderApp('/s/s-1/goals/new')
    await screen.findByRole('option', { name: /Dollars/ })
    await user.selectOptions(screen.getByLabelText('From wallet'), 'w-5')
    expect(screen.getByTestId('available')).toHaveTextContent('$34.26')
  })

  it('creates a goal, reserving part of a wallet right away', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post(G, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(goal({ id: 'g-9' }), { status: 201 })
      }),
      http.get(`${G}/g-9`, () => HttpResponse.json(goal({ id: 'g-9' }))),
    )
    const user = userEvent.setup()
    const { router } = renderApp('/s/s-1/goals/new')
    await user.type(await screen.findByLabelText('Name'), 'Holiday')
    for (const k of ['1', '0', '0', '0', '0'])
      await user.click(
        screen.getAllByRole('button', { name: new RegExp(`^${k}$`) })[0] as HTMLElement,
      )
    await user.type(screen.getByLabelText('Target date (optional)'), '2027-05-01')
    await screen.findByRole('option', { name: /Dollars/ })
    await user.selectOptions(screen.getByLabelText('From wallet'), 'w-5')
    const amount = screen.getAllByRole('button', { name: /^2$/ }).at(-1) as HTMLElement
    await user.click(amount)
    await user.click(screen.getAllByRole('button', { name: /^0$/ }).at(-1) as HTMLElement)
    expect(await screen.findByTestId('available-after')).toHaveTextContent('$14.26') // 34.26 - 20
    await user.click(screen.getByRole('button', { name: 'Add goal' }))
    await waitFor(() =>
      expect(body).toMatchObject({
        name: 'Holiday',
        targetAmount: '10000',
        targetDate: '2027-05-01',
        initialReserve: { walletId: 'w-5', amount: '20.00' },
      }),
    )
    await waitFor(() => expect(router.state.location.pathname).toBe('/s/s-1/goals/g-9'))
  })

  it('blocks a reserve above the available balance, and never sends it', async () => {
    const called = vi.fn()
    server.use(
      http.post(G, () => {
        called()
        return HttpResponse.json(goal(), { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/goals/new')
    await user.type(await screen.findByLabelText('Name'), 'Holiday')
    await user.selectOptions(screen.getByLabelText('From wallet'), 'w-5')
    for (const k of ['5', '0'])
      await user.click(
        screen.getAllByRole('button', { name: new RegExp(`^${k}$`) }).at(-1) as HTMLElement,
      )
    expect(
      await screen.findByText('That is more than the available balance in this wallet.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add goal' })).toBeDisabled()
    expect(called).not.toHaveBeenCalled()
  })

  it('validates name and target', async () => {
    const user = userEvent.setup()
    renderApp('/s/s-1/goals/new')
    await user.click(await screen.findByRole('button', { name: 'Add goal' }))
    expect(await screen.findByText('Enter a name')).toBeInTheDocument()
    expect(screen.getByText('Enter a target above zero')).toBeInTheDocument()
  })
})

describe('allocations on a goal', () => {
  const alloc = [
    {
      walletId: 'w-5',
      walletName: 'Dollars',
      walletCurrency: 'USD',
      amount: '100',
      converted: '100',
    },
  ]
  const g = goal({
    currency: 'USD',
    targetAmount: '1000',
    progress: '100',
    progressPct: '10.00',
    allocations: alloc,
  })
  beforeEach(() =>
    server.use(
      http.get(`${G}/g-1`, () => HttpResponse.json(g)),
      http.get(W, () => HttpResponse.json(walletList([dollars]))),
    ),
  )

  it('lets a goal that already holds 100 raise it to 134.26 (available plus its own hold), and no further', async () => {
    let body: unknown
    server.use(
      http.put(`${G}/g-1/allocations/w-5`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(g)
      }),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/goals/g-1')
    const field = await screen.findByLabelText('Reserved for this goal (USD)')
    expect(field).toHaveValue('100')
    expect(screen.getByText(/Available/)).toHaveTextContent('$34.26')
    await user.clear(field)
    await user.type(field, '134.27')
    expect(
      await screen.findByText('That is more than the available balance in this wallet.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    await user.clear(field)
    await user.type(field, '134.26')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(body).toEqual({ amount: '134.26' }))
  })

  it('0 clears the reservation', async () => {
    let body: unknown
    server.use(
      http.put(`${G}/g-1/allocations/w-5`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(g)
      }),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/goals/g-1')
    const field = await screen.findByLabelText('Reserved for this goal (USD)')
    await user.clear(field)
    await user.type(field, '0')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(body).toEqual({ amount: '0.00' }))
  })

  it('explains INSUFFICIENT_AVAILABLE_BALANCE if the server disagrees', async () => {
    server.use(
      http.put(`${G}/g-1/allocations/w-5`, () =>
        HttpResponse.json(errorEnvelope('INSUFFICIENT_AVAILABLE_BALANCE'), { status: 422 }),
      ),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/goals/g-1')
    const field = await screen.findByLabelText('Reserved for this goal (USD)')
    await user.clear(field)
    await user.type(field, '120')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(
      await screen.findByText("The wallet doesn't have enough available balance."),
    ).toBeInTheDocument()
  })

  it('shows over-reserved as a warning on the goal, never as an error', async () => {
    server.use(
      http.get(W, () =>
        HttpResponse.json(
          walletList([{ ...dollars, balance: '60', available: '-40', overReserved: true }]),
        ),
      ),
    )
    renderApp('/s/s-1/goals/g-1')
    expect(
      await screen.findByText(
        /One of the wallets behind this goal has less money than is reserved/,
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('This wallet has less than is reserved in it.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument() // a warning is a status, not an alert
  })

  it('a goal reaching its target shows the achieved state', async () => {
    server.use(
      http.get(`${G}/g-1`, () =>
        HttpResponse.json(
          goal({
            ...g,
            progress: '1000',
            progressPct: '100.00',
            achievedAt: '2026-11-19T00:00:00Z',
            remaining: '0',
            requiredMonthly: undefined,
          }),
        ),
      ),
    )
    renderApp('/s/s-1/goals/g-1')
    expect(await screen.findByText('Goal achieved')).toBeInTheDocument()
    expect(screen.queryByText(/to go/)).not.toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Progress' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    )
  })

  it('deletes after confirming', async () => {
    const deleted = vi.fn()
    server.use(
      http.delete(`${G}/g-1`, () => {
        deleted()
        return new HttpResponse(null, { status: 204 })
      }),
      http.get(G, () => HttpResponse.json({ items: [] })),
    )
    const user = userEvent.setup()
    const { router } = renderApp('/s/s-1/goals/g-1')
    await user.click(await screen.findByRole('button', { name: 'Delete goal' }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete Holiday?' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete goal' }))
    await waitFor(() => expect(deleted).toHaveBeenCalled())
    await waitFor(() => expect(router.state.location.pathname).toBe('/s/s-1/goals'))
  })
})

describe('wallet detail: reserved and available', () => {
  it('a wallet of 134.26 with 100 reserved shows 34.26 available on its detail screen', async () => {
    server.use(
      http.get(`${W}/w-5`, () => HttpResponse.json(dollars)),
      http.get(`${BASE}/spaces/s-1/transactions`, () => HttpResponse.json({ items: [] })),
    )
    renderApp('/s/s-1/wallets/w-5')
    const lines = await screen.findByTestId('reserve-lines')
    expect(lines).toHaveTextContent('Reserved for goals$100.00')
    expect(lines).toHaveTextContent('Available$34.26')
  })

  it('shows nothing extra when nothing is reserved, and a warning (not an error) when over-reserved', async () => {
    server.use(
      http.get(`${W}/w-5`, () =>
        HttpResponse.json({ ...dollars, reserved: '0', available: '134.26' }),
      ),
      http.get(`${BASE}/spaces/s-1/transactions`, () => HttpResponse.json({ items: [] })),
    )
    const { unmount } = renderApp('/s/s-1/wallets/w-5')
    await screen.findByRole('heading', { name: 'Dollars' })
    expect(screen.queryByTestId('reserve-lines')).not.toBeInTheDocument()
    unmount()

    server.use(
      http.get(`${W}/w-5`, () =>
        HttpResponse.json({ ...dollars, balance: '60', available: '-40', overReserved: true }),
      ),
    )
    renderApp('/s/s-1/wallets/w-5')
    const lines = await screen.findByTestId('reserve-lines')
    expect(
      within(lines).getByText('This wallet has less than is reserved in it.'),
    ).toBeInTheDocument()
    expect(within(lines).getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
