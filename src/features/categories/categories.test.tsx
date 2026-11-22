import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { createQueryClient } from '@/shared/api/queryClient'
import { CategoryPicker } from '@/shared/ui/CategoryPicker'
import { BASE, errorEnvelope, makeAuthedHandlers } from '../../../test/msw/api'
import { cat, seededExpense, seededIncome, withStats } from '../../../test/msw/categories'
import { server } from '../../../test/msw/server'
import { renderApp } from '../../../test/renderApp'
import { BudgetProgress, barWidth, isOverBudget } from './BudgetProgress'

const C = `${BASE}/spaces/s-1/categories`

/** Serves a type-filtered list like the real API does. */
function categoriesHandler(all: ReturnType<typeof cat>[]) {
  return http.get(C, ({ request }) => {
    const type = new URL(request.url).searchParams.get('type')
    return HttpResponse.json(all.filter((c) => !type || c.type === type))
  })
}

describe('budget progress helpers', () => {
  it('clamps only the bar, never the number', () => {
    expect(barWidth('42.50')).toBe(42.5)
    expect(barWidth('100')).toBe(100)
    expect(barWidth('163.20')).toBe(100)
    expect(barWidth('-5')).toBe(0)
    expect(isOverBudget('100.00')).toBe(false)
    expect(isOverBudget('100.01')).toBe(true)
  })

  it('shows the server percentage exactly as given', () => {
    render(
      <BudgetProgress
        usedPct="42.50"
        spent="212500"
        budget="500000"
        remaining="287500"
        currency="IDR"
      />,
    )
    expect(screen.getByText(/42\.50% used/)).toBeInTheDocument()
    const bar = screen.getByRole('progressbar', { name: 'Budget used' })
    expect(bar).toHaveAttribute('aria-valuenow', '42.5')
  })

  it('does not recompute from spent and budget (a mismatching pct wins)', () => {
    // 100 of 1000 is 10%, but the server says 77.00. The UI must show the server's number.
    render(
      <BudgetProgress usedPct="77.00" spent="100" budget="1000" remaining="900" currency="IDR" />,
    )
    expect(screen.getByText(/77\.00% used/)).toBeInTheDocument()
    expect(screen.queryByText(/10\.00%/)).not.toBeInTheDocument()
  })

  it('switches to an over-budget state past 100%', () => {
    const { container } = render(
      <BudgetProgress
        usedPct="125.00"
        spent="625000"
        budget="500000"
        remaining="-125000"
        currency="IDR"
      />,
    )
    expect(screen.getByText(/Over budget/)).toBeInTheDocument()
    expect(container.querySelector('[data-over]')).toBeInTheDocument()
  })
})

describe('categories screen', () => {
  beforeEach(() => server.use(...makeAuthedHandlers()))

  it("shows a new space's 7 expense and 4 income categories with no client-side seeding", async () => {
    server.use(categoriesHandler([...seededExpense, ...seededIncome]))
    const user = userEvent.setup()
    renderApp('/s/s-1/categories')
    expect(await screen.findByText('Food')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Edit / })).toHaveLength(7)
    await user.click(screen.getByRole('radio', { name: 'Income' }))
    expect(await screen.findByText('Salary')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Edit / })).toHaveLength(4)
  })

  it('keeps the open tab in the URL', async () => {
    server.use(categoriesHandler([...seededExpense, ...seededIncome]))
    const { router } = renderApp('/s/s-1/categories?tab=INCOME')
    expect(await screen.findByText('Salary')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Income' })).toBeChecked()
    expect(router.state.location.search).toMatchObject({ tab: 'INCOME' })
  })

  it('requests stats here, and the picker does not', async () => {
    const statsFlags: Array<string | null> = []
    server.use(
      http.get(C, ({ request }) => {
        statsFlags.push(new URL(request.url).searchParams.get('includeStats'))
        return HttpResponse.json(seededExpense)
      }),
    )
    renderApp('/s/s-1/categories')
    await screen.findByText('Food')
    expect(statsFlags).toContain('true')
  })

  it('shows a budget bar from the server percentage, or spend-to-date without a budget', async () => {
    server.use(
      categoriesHandler([
        withStats(
          cat({
            id: 'e-1',
            name: 'Food',
            type: 'EXPENSE',
            budgetAmount: '500000',
            budgetCurrency: 'IDR',
          }),
          {
            currency: 'IDR',
            spent: '212500',
            budgetRemaining: '287500',
            budgetUsedPct: '42.50',
          },
        ),
        withStats(cat({ id: 'e-2', name: 'Coffee', type: 'EXPENSE' }), {
          currency: 'IDR',
          spent: '90000',
        }),
        withStats(cat({ id: 'e-3', name: 'Rent', type: 'EXPENSE', budgetAmount: '1000000' }), {
          currency: 'IDR',
          spent: '1250000',
          budgetRemaining: '-250000',
          budgetUsedPct: '125.00',
        }),
      ]),
    )
    renderApp('/s/s-1/categories')
    await screen.findByText('Food')
    expect(screen.getByText(/42\.50% used/)).toBeInTheDocument()
    expect(screen.getByText(/Spent/)).toHaveTextContent('IDR 90,000')
    expect(screen.getByText(/Over budget/)).toBeInTheDocument()
    expect(screen.getAllByRole('progressbar')).toHaveLength(2) // Coffee has no budget, so no bar
  })

  it('shows income as received-to-date', async () => {
    server.use(
      categoriesHandler([
        withStats(cat({ id: 'i-1', name: 'Salary', type: 'INCOME' }), {
          currency: 'IDR',
          received: '5000000',
        }),
      ]),
    )
    renderApp('/s/s-1/categories?tab=INCOME')
    await screen.findByText('Salary')
    expect(screen.getByText(/Received/)).toHaveTextContent('IDR 5,000,000')
  })

  it('has empty, error-with-retry and loading states', async () => {
    let mode: 'empty' | 'error' = 'error'
    server.use(
      http.get(C, async () => {
        await new Promise((r) => setTimeout(r, 50))
        return mode === 'error'
          ? HttpResponse.json(errorEnvelope('INTERNAL_ERROR'), { status: 500 })
          : HttpResponse.json([])
      }),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/categories')
    await screen.findByRole('heading', { name: 'Categories' })
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument()
    expect(await screen.findByText("Couldn't load categories")).toBeInTheDocument()
    mode = 'empty'
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('No expense categories')).toBeInTheDocument()
  })
})

describe('create and edit', () => {
  beforeEach(() => server.use(...makeAuthedHandlers()))

  async function openNew(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: /^Add$/ }))
    return screen.findByRole('dialog', { name: /New expense category/ })
  }

  it('creates an expense category with a budget', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      categoriesHandler(seededExpense),
      http.post(C, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(cat({ id: 'e-new', name: 'Pets', type: 'EXPENSE' }), {
          status: 201,
        })
      }),
      http.get(`${BASE}/categories/suggestions`, () => HttpResponse.json([])),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/categories')
    const sheet = await openNew(user)
    await user.type(within(sheet).getByLabelText('Name'), 'Pets')
    for (const k of ['2', '5', '0', '0', '0', '0'])
      await user.click(within(sheet).getByRole('button', { name: new RegExp(`^${k}$`) }))
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(body).toMatchObject({ type: 'EXPENSE', name: 'Pets', budgetAmount: '250000' }),
    )
  })

  it('hides the budget field for income, so BUDGET_NOT_ALLOWED is unreachable', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      categoriesHandler(seededIncome),
      http.post(C, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(cat({ id: 'i-new', name: 'Gift', type: 'INCOME' }), {
          status: 201,
        })
      }),
      http.get(`${BASE}/categories/suggestions`, () => HttpResponse.json([])),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/categories?tab=INCOME')
    await user.click(await screen.findByRole('button', { name: /^Add$/ }))
    const sheet = await screen.findByRole('dialog', { name: /New income category/ })
    expect(within(sheet).queryByText(/Monthly budget/)).not.toBeInTheDocument()
    await user.type(within(sheet).getByLabelText('Name'), 'Gift')
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(body.name).toBe('Gift'))
    expect(body).not.toHaveProperty('budgetAmount')
  })

  it('prefills the name from a tappable suggestion', async () => {
    server.use(
      categoriesHandler(seededExpense),
      http.get(`${BASE}/categories/suggestions`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('type')).toBe('EXPENSE')
        return HttpResponse.json(['Coffee', 'Groceries'])
      }),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/categories')
    const sheet = await openNew(user)
    await user.click(await within(sheet).findByRole('button', { name: 'Groceries' }))
    expect(within(sheet).getByLabelText('Name')).toHaveValue('Groceries')
  })

  it('surfaces CATEGORY_NAME_TAKEN as an inline field error', async () => {
    server.use(
      categoriesHandler(seededExpense),
      http.post(C, () => HttpResponse.json(errorEnvelope('CATEGORY_NAME_TAKEN'), { status: 409 })),
      http.get(`${BASE}/categories/suggestions`, () => HttpResponse.json([])),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/categories')
    const sheet = await openNew(user)
    await user.type(within(sheet).getByLabelText('Name'), 'Food')
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))
    const field = await within(sheet).findByText('You already have a category with this name.')
    expect(field).toBeInTheDocument()
    expect(within(sheet).getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')
    expect(within(sheet).queryByRole('alert', { name: '' })).toBeInTheDocument() // the field error itself, not a banner
  })

  it('rejects an empty name and a zero budget before calling the server', async () => {
    const called = vi.fn()
    server.use(
      categoriesHandler(seededExpense),
      http.post(C, () => {
        called()
        return HttpResponse.json(seededExpense[0])
      }),
      http.get(`${BASE}/categories/suggestions`, () => HttpResponse.json([])),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/categories')
    const sheet = await openNew(user)
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(await within(sheet).findByText('Enter a name')).toBeInTheDocument()
    await user.type(within(sheet).getByLabelText('Name'), 'X')
    await user.click(within(sheet).getByRole('button', { name: '0' }))
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(await within(sheet).findByText('Enter an amount greater than zero')).toBeInTheDocument()
    expect(called).not.toHaveBeenCalled()
  })

  it('edits a category, sends null to clear its budget, and keeps its type fixed', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      categoriesHandler([
        cat({
          id: 'e-1',
          name: 'Food',
          type: 'EXPENSE',
          budgetAmount: '500000',
          budgetCurrency: 'IDR',
        }),
      ]),
      http.patch(`${C}/e-1`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(cat({ id: 'e-1', name: 'Food', type: 'EXPENSE' }))
      }),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/categories')
    await user.click(await screen.findByRole('button', { name: 'Edit Food' }))
    const sheet = await screen.findByRole('dialog', { name: 'Edit category' })
    // Clear the budget: the field starts with the existing value, so backspace it away.
    await user.click(within(sheet).getByRole('button', { name: 'Clear' }))
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(body).toHaveProperty('budgetAmount', null))
    expect(body).not.toHaveProperty('type')
  })
})

describe('reorder and delete', () => {
  beforeEach(() => server.use(...makeAuthedHandlers()))

  it('reorders within a type and sends the type with the ids', async () => {
    let body: unknown
    server.use(
      categoriesHandler(seededExpense),
      http.put(`${C}/order`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(seededExpense)
      }),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/categories')
    await screen.findByText('Food')
    await user.click(screen.getByRole('button', { name: 'Reorder' }))
    await user.click(screen.getByRole('button', { name: 'Move Transport up' }))
    await waitFor(() => expect(body).toMatchObject({ type: 'EXPENSE' }))
    expect((body as { ids: string[] }).ids.slice(0, 2)).toEqual(['e-1', 'e-0'])
  })

  it('snaps back with a toast when reordering fails', async () => {
    server.use(
      categoriesHandler(seededExpense),
      http.put(`${C}/order`, () =>
        HttpResponse.json(errorEnvelope('INTERNAL_ERROR'), { status: 500 }),
      ),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/categories')
    await screen.findByText('Food')
    await user.click(screen.getByRole('button', { name: 'Reorder' }))
    await user.click(screen.getByRole('button', { name: 'Move Transport up' }))
    // In reorder mode the rows show move buttons, so read the order from the row text.
    const names = () => screen.getAllByRole('listitem').map((li) => li.textContent ?? '')
    await waitFor(() => {
      expect(names()[0]).toContain('Food')
      expect(names()[1]).toContain('Transport')
    })
    expect(await screen.findByText(/Something went wrong on our side/)).toBeInTheDocument()
  })

  it('explains that past transactions keep a deleted category', async () => {
    const deleted: string[] = []
    server.use(
      categoriesHandler(seededExpense),
      http.delete(`${C}/:id`, ({ params }) => {
        deleted.push(String(params.id))
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/categories')
    await user.click(await screen.findByRole('button', { name: 'Delete Food' }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete Food?' })
    expect(confirm).toHaveTextContent('Your past transactions keep this category')
    await user.click(within(confirm).getByRole('button', { name: 'Delete category' }))
    await waitFor(() => expect(deleted).toEqual(['e-0']))
  })
})

describe('CategoryPicker', () => {
  function renderPicker(
    type: 'EXPENSE' | 'INCOME',
    onChange = vi.fn(),
    value: string | null = null,
  ) {
    const client = createQueryClient(() => {})
    client.setDefaultOptions({ queries: { retry: false } })
    render(
      <QueryClientProvider client={client}>
        <CategoryPicker spaceId="s-1" type={type} value={value} onChange={onChange} />
      </QueryClientProvider>,
    )
    return onChange
  }

  it('offers only categories of the requested type (the type is sent to the API)', async () => {
    const types: Array<string | null> = []
    server.use(
      http.get(C, ({ request }) => {
        const t = new URL(request.url).searchParams.get('type')
        types.push(t)
        return HttpResponse.json([...seededExpense, ...seededIncome].filter((c) => c.type === t))
      }),
    )
    renderPicker('INCOME')
    expect(await screen.findByRole('button', { name: /Salary/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Food/ })).not.toBeInTheDocument()
    expect(types).toEqual(['INCOME'])
  })

  it('does not request stats', async () => {
    const flags: Array<string | null> = []
    server.use(
      http.get(C, ({ request }) => {
        flags.push(new URL(request.url).searchParams.get('includeStats'))
        return HttpResponse.json(seededExpense)
      }),
    )
    renderPicker('EXPENSE')
    await screen.findByRole('button', { name: /Food/ })
    expect(flags).toEqual([null])
  })

  it('selects, and toggles the selection off when pressed again', async () => {
    server.use(categoriesHandler(seededExpense))
    const user = userEvent.setup()
    const onChange = renderPicker('EXPENSE', vi.fn(), 'e-0')
    const food = await screen.findByRole('button', { name: /Food/ })
    expect(food).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: /Transport/ }))
    expect(onChange).toHaveBeenLastCalledWith('e-1')
    await user.click(food)
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('has loading, empty and error states', async () => {
    let mode: 'error' | 'empty' = 'error'
    server.use(
      http.get(C, async () => {
        await new Promise((r) => setTimeout(r, 40))
        return mode === 'error'
          ? HttpResponse.json(errorEnvelope('INTERNAL_ERROR'), { status: 500 })
          : HttpResponse.json([])
      }),
    )
    const user = userEvent.setup()
    renderPicker('EXPENSE')
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument()
    expect(await screen.findByText(/Couldn't load categories/)).toBeInTheDocument()
    mode = 'empty'
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('No expense categories yet.')).toBeInTheDocument()
  })
})
