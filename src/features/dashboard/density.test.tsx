// biome-ignore-all lint/plugin: fixtures only
import { render, screen, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { setMedia } from '../../../test/matchMedia'
import { BASE, makeAuthedHandlers } from '../../../test/msw/api'
import { seededExpense, seededIncome } from '../../../test/msw/categories'
import { analytics, breakdown, calendar, overview } from '../../../test/msw/dashboard'
import { server } from '../../../test/msw/server'
import { bank, cash, walletList } from '../../../test/msw/wallets'
import { renderApp } from '../../../test/renderApp'
import { Card } from '../../shared/ui/Card'
import { Page } from '../../shared/ui/Page'
import { STAGGER, staggerStyle } from '../../shared/ui/stagger'

const S = `${BASE}/spaces/s-1`

beforeEach(() => {
  setMedia({ desktop: true, wide: true })
  server.use(...makeAuthedHandlers())
  server.use(
    http.get(`${S}/dashboard/overview`, () => HttpResponse.json(overview())),
    http.get(`${S}/dashboard/category-breakdown`, () => HttpResponse.json(breakdown())),
    http.get(`${S}/dashboard/analytics`, () => HttpResponse.json(analytics())),
    http.get(`${S}/dashboard/calendar`, () => HttpResponse.json(calendar('2026-11'))),
    http.get(`${S}/wallets`, () => HttpResponse.json(walletList([cash, bank]))),
    http.get(`${S}/categories`, ({ request }) => {
      const type = new URL(request.url).searchParams.get('type')
      return HttpResponse.json(
        [...seededExpense, ...seededIncome].filter((c) => !type || c.type === type),
      )
    }),
  )
})
afterEach(() => setMedia({ desktop: false, wide: false }))

describe('shared card, page and gap', () => {
  it('Card is one surface, and only interactive cards lift and press', () => {
    render(
      <>
        <Card data-testid="plain">a</Card>
        <Card data-testid="link" interactive>
          b
        </Card>
      </>,
    )
    expect(screen.getByTestId('plain')).toHaveClass('rounded-lg', 'border', 'p-4', 'lg:p-5')
    expect(screen.getByTestId('plain')).not.toHaveClass('card-interactive')
    expect(screen.getByTestId('link')).toHaveClass('card-interactive')
  })

  it('pages share one gap scale: 16px, 24px from lg', () => {
    render(<Page data-testid="p">x</Page>)
    expect(screen.getByTestId('p')).toHaveClass('gap-4', 'lg:gap-6', 'max-w-[var(--page-max-wide)]')
  })

  it('stagger sets the row index the CSS delay uses', () => {
    expect(staggerStyle(3)).toEqual({ '--i': 3 })
    expect(STAGGER).toBe('stagger-in')
  })
})

describe('home on desktop', () => {
  it('lays out a hero row (net worth 8 + overview 4) and three equal cards, all easing in', async () => {
    renderApp('/s/s-1')
    const grid = await screen.findByTestId('home-grid')
    const cells = [...grid.children] as HTMLElement[]
    expect(cells.map((c) => [...c.classList].find((x) => x.startsWith('lg:col-span')))).toEqual([
      'lg:col-span-8',
      'lg:col-span-4',
      'lg:col-span-4',
      'lg:col-span-4',
      'lg:col-span-4',
    ])
    for (const [i, c] of cells.entries()) {
      expect(c).toHaveClass('stagger-in')
      expect(c.style.getPropertyValue('--i')).toBe(String(i))
    }
  })

  it('counts up the expenses and income headline numbers', async () => {
    renderApp('/s/s-1')
    const o = await screen.findByTestId('overview')
    expect(o.querySelectorAll('[data-frame]').length).toBe(2)
  })
})

describe('wallets on desktop', () => {
  it('shows a card grid, not the overlapped deck, with the total and share as a right rail', async () => {
    renderApp('/s/s-1/wallets')
    expect(await screen.findAllByTestId('wallet-grid-item')).toHaveLength(2)
    expect(screen.queryByTestId('wallet-stack-item')).not.toBeInTheDocument()
    expect(screen.getByTestId('wallets-total').querySelector('[data-frame]')).not.toBeNull()
    expect(screen.getByRole('region', { name: 'Balance share' })).toHaveClass('lg:col-start-9')
  })
})

describe('categories on desktop', () => {
  it('puts a category split donut beside the list', async () => {
    renderApp('/s/s-1/categories')
    const rail = await screen.findByTestId('category-rail')
    expect(within(rail).getByTestId('donut-chart')).toBeInTheDocument()
    expect(await screen.findAllByRole('button', { name: /^Edit / })).not.toHaveLength(0)
  })
})
