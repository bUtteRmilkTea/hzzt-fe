// biome-ignore-all lint/plugin: fixtures only
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { axeViolations } from '../test/axe'
import { BASE, makeAuthedHandlers, ownerSpace } from '../test/msw/api'
import { debt, goal, summary } from '../test/msw/assets'
import { cat, seededExpense, seededIncome } from '../test/msw/categories'
import { analytics, breakdown, calendar, overview } from '../test/msw/dashboard'
import { btc, list, metas } from '../test/msw/investments'
import { server } from '../test/msw/server'
import { bank, cash, savings, txn, walletList } from '../test/msw/wallets'
import { renderApp } from '../test/renderApp'

/** Installs enough of the API that every screen renders real content, not just its empty state. */
function seed() {
  server.use(...makeAuthedHandlers())
  server.use(
    http.get(`${BASE}/investment-types`, () => HttpResponse.json(metas)),
    http.get(`${BASE}/spaces/s-1/wallets`, () =>
      HttpResponse.json(
        walletList([
          { ...cash, sortOrder: 0 },
          { ...bank, sortOrder: 1 },
          { ...savings, isFavorite: false, sortOrder: 2 },
        ]),
      ),
    ),
    http.get(`${BASE}/spaces/s-1/wallets/w-1`, () => HttpResponse.json(cash)),
    http.get(`${BASE}/spaces/s-1/categories`, ({ request }) => {
      const t = new URL(request.url).searchParams.get('type')
      return HttpResponse.json(
        [...seededExpense, ...seededIncome, cat({ id: 'x', name: 'X', type: 'EXPENSE' })].filter(
          (c) => !t || c.type === t,
        ),
      )
    }),
    http.get(`${BASE}/spaces/s-1/transactions`, () =>
      HttpResponse.json({ items: [txn({ occurredAt: new Date().toISOString() })] }),
    ),
    http.get(`${BASE}/spaces/s-1/transactions/daily-summary`, () =>
      HttpResponse.json({ currency: 'IDR', warnings: [], items: [] }),
    ),
    http.get(`${BASE}/spaces/s-1/investments`, () => HttpResponse.json(list([btc]))),
    http.get(`${BASE}/spaces/s-1/investments/i-1`, () => HttpResponse.json(btc)),
    http.get(`${BASE}/spaces/s-1/investments/i-1/participants`, () =>
      HttpResponse.json({
        items: [
          { id: 'p', role: 'OWNER', displayName: 'Jane', sharePct: '100.00', status: 'ACTIVE' },
        ],
      }),
    ),
    http.get(`${BASE}/spaces/s-1/net-worth/summary`, () => HttpResponse.json(summary())),
    http.get(`${BASE}/spaces/s-1/net-worth/history`, () =>
      HttpResponse.json({
        currency: 'IDR',
        changePct: '3',
        points: [
          { date: '2026-11-01', netWorth: '1' },
          { date: '2026-11-19', netWorth: '2', live: true },
        ],
      }),
    ),
    http.get(`${BASE}/spaces/s-1/manual-assets`, () =>
      HttpResponse.json({ items: [debt], totals: {} }),
    ),
    http.get(`${BASE}/spaces/s-1/manual-assets/a-1`, () => HttpResponse.json(debt)),
    http.get(`${BASE}/spaces/s-1/goals`, () => HttpResponse.json({ items: [goal()] })),
    http.get(`${BASE}/spaces/s-1/goals/g-1`, () => HttpResponse.json(goal())),
    http.get(`${BASE}/spaces/s-1/dashboard/overview`, () => HttpResponse.json(overview())),
    http.get(`${BASE}/spaces/s-1/dashboard/category-breakdown`, () =>
      HttpResponse.json(breakdown()),
    ),
    http.get(`${BASE}/spaces/s-1/dashboard/analytics`, () => HttpResponse.json(analytics())),
    http.get(`${BASE}/spaces/s-1/dashboard/calendar`, ({ request }) =>
      HttpResponse.json(calendar(new URL(request.url).searchParams.get('month') ?? '2026-11')),
    ),
    http.get(`${BASE}/spaces/s-1/members`, () =>
      HttpResponse.json([
        { userId: 'u-1', name: 'Jane', email: 'jane@example.com', role: 'OWNER' },
      ]),
    ),
    http.get(`${BASE}/spaces/s-1/invitations/active`, () => HttpResponse.json({})),
    http.get(`${BASE}/me/shared-investment-invitations`, () => HttpResponse.json([])),
    http.get(`${BASE}/spaces/s-1/fx/manual-rates`, () => HttpResponse.json([])),
  )
}

// [path, something that is on screen once the route has rendered]
const ROUTES: Array<[string, RegExp | string]> = [
  ['/s/s-1', 'Home'],
  ['/s/s-1/history', 'History'],
  ['/s/s-1/wallets', 'Wallets'],
  ['/s/s-1/wallets/w-1', 'Cash'],
  ['/s/s-1/wallets/w-1/edit', 'Edit wallet'],
  ['/s/s-1/wallets/w-1/card', 'Card style'],
  ['/s/s-1/categories', 'Categories'],
  ['/s/s-1/assets', 'Assets'],
  ['/s/s-1/assets/a-1', 'Car loan'],
  ['/s/s-1/assets/new?kind=LIABILITY', 'Add debt'],
  ['/s/s-1/goals', 'Goals'],
  ['/s/s-1/goals/new', 'Add goal'],
  ['/s/s-1/goals/g-1', 'Holiday'],
  ['/s/s-1/investments', 'Investments'],
  ['/s/s-1/investments/new', 'Add investment'],
  ['/s/s-1/investments/i-1', 'Bitcoin'],
  ['/s/s-1/investments/i-1/sharing', 'Share'],
  ['/invitations/shared', 'Shared investments'],
  ['/settings', 'Settings'],
  ['/settings/profile', 'Profile'],
  ['/settings/security', 'Security'],
  ['/settings/space', 'Space'],
  ['/settings/currency', 'Currency'],
  ['/invitations/abc', "You've been invited to a space"],
]

describe('axe: authenticated routes', () => {
  it.each(ROUTES)('%s has no accessibility violations', async (path, marker) => {
    seed()
    renderApp(path)
    await screen.findAllByText(marker, undefined, { timeout: 8000 })
    // let queries settle so the real content (not skeletons) is what gets checked
    await new Promise((r) => setTimeout(r, 300))
    expect(await axeViolations()).toEqual([])
  })
})

describe('axe: signed-out routes', () => {
  it.each([
    ['/login', 'Welcome back'],
    ['/register', 'Create your account'],
    ['/forgot-password', 'Reset your password'],
    ['/reset-password?token=abc', 'Choose a new password'],
    ['/_gallery', 'Component gallery'],
  ])('%s has no accessibility violations', async (path, marker) => {
    renderApp(path)
    await screen.findByRole('heading', { name: marker }, { timeout: 8000 })
    expect(await axeViolations()).toEqual([])
  })
})

describe('axe: sheets and dialogs', () => {
  it('the add-transaction sheet', async () => {
    seed()
    const user = userEvent.setup()
    renderApp('/s/s-1/history')
    await user.click(await screen.findByRole('button', { name: 'Add transaction' }))
    await screen.findByRole('dialog', { name: 'Add transaction' })
    await new Promise((r) => setTimeout(r, 300))
    expect(await axeViolations()).toEqual([])
  })

  it('the filter sheet', async () => {
    seed()
    renderApp('/s/s-1/history/filters')
    await screen.findByRole('dialog', { name: 'Filters' })
    await new Promise((r) => setTimeout(r, 300))
    expect(await axeViolations()).toEqual([])
  })

  it('the space switcher', async () => {
    seed()
    const user = userEvent.setup()
    renderApp('/s/s-1')
    await user.click(await screen.findByRole('button', { name: /Switch space/ }))
    await screen.findByRole('dialog', { name: 'Your spaces' })
    expect(await axeViolations()).toEqual([])
  })

  it('the app lock screen', async () => {
    seed()
    server.use(
      ...makeAuthedHandlers({
        preferences: { hideAmounts: false, keyboardType: 'MINI_CALCULATOR', appLockEnabled: true },
      }),
    )
    renderApp('/s/s-1')
    await screen.findByRole('dialog', { name: 'App locked' })
    expect(await axeViolations()).toEqual([])
  })

  it('a confirm dialog', async () => {
    seed()
    const user = userEvent.setup()
    renderApp('/s/s-1/wallets/w-1')
    await user.click(await screen.findByRole('button', { name: 'Wallet options' }))
    await user.click(await screen.findByRole('button', { name: /Delete wallet/ }))
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: 'Delete this wallet?' })).toBeInTheDocument(),
    )
    expect(await axeViolations()).toEqual([])
  })
})

void ownerSpace
