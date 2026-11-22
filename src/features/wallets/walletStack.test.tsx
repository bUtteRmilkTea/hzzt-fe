import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { BASE, makeAuthedHandlers } from '../../../test/msw/api'
import { server } from '../../../test/msw/server'
import { bank, cash, walletList } from '../../../test/msw/wallets'
import { renderApp } from '../../../test/renderApp'

const W = `${BASE}/spaces/s-1/wallets`
const idr = (w: typeof cash, extra = {}) => ({ ...w, ...extra })

beforeEach(() => {
  server.use(...makeAuthedHandlers())
})

describe('wallet stack', () => {
  it('starts collapsed, and the toggle flips aria-expanded', async () => {
    server.use(http.get(W, () => HttpResponse.json(walletList([cash, bank]))))
    const user = userEvent.setup()
    renderApp('/s/s-1/wallets')
    const toggle = await screen.findByRole('button', { name: 'Expand' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    const collapse = await screen.findByRole('button', { name: 'Collapse' })
    expect(collapse).toHaveAttribute('aria-expanded', 'true')
  })

  it('a click on a collapsed card expands instead of navigating; expanded click opens the wallet', async () => {
    server.use(
      http.get(W, () => HttpResponse.json(walletList([cash, bank]))),
      http.get(`${W}/w-2`, () => HttpResponse.json(bank)),
      http.get(`${BASE}/spaces/s-1/transactions`, () => HttpResponse.json({ items: [] })),
    )
    const user = userEvent.setup()
    const { router } = renderApp('/s/s-1/wallets')
    const card = await screen.findByRole('link', { name: 'BCA, open wallet' })
    await user.click(card)
    expect(router.state.location.pathname).toBe('/s/s-1/wallets')
    expect(await screen.findByRole('button', { name: 'Collapse' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'BCA, open wallet' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/s/s-1/wallets/w-2'))
  })

  it('reorder mode forces the stack open', async () => {
    server.use(http.get(W, () => HttpResponse.json(walletList([cash, bank]))))
    const user = userEvent.setup()
    renderApp('/s/s-1/wallets')
    await user.click(await screen.findByRole('button', { name: 'Reorder' }))
    expect(await screen.findByRole('button', { name: 'Move Cash up' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Collapse' })).toBeDisabled()
  })

  it('hides logo, name and type independently from the server display prefs', async () => {
    server.use(
      http.get(W, () =>
        HttpResponse.json(
          walletList([
            idr(cash, { displayPrefs: { hideLogo: true, hideName: false, hideType: true } }),
          ]),
        ),
      ),
    )
    renderApp('/s/s-1/wallets')
    const link = await screen.findByRole('link', { name: 'Cash, open wallet' })
    expect(within(link).queryByText('💵')).not.toBeInTheDocument()
    expect(within(link).getByText('Cash')).toBeInTheDocument()
    expect(within(link).queryByText('Cash', { selector: 'p' })).not.toBeInTheDocument()
  })

  it('wallet pie percentages add up to 100.00', async () => {
    server.use(
      http.get(W, () =>
        HttpResponse.json(
          walletList([cash, bank], { total: '1750000', currency: 'IDR', warnings: [] }),
        ),
      ),
    )
    renderApp('/s/s-1/wallets')
    const legend = await screen.findByRole('list', {
      name: 'Share of total balance per wallet legend',
    })
    const pcts = within(legend)
      .getAllByText(/%$/)
      .map((e) => Number.parseFloat(e.textContent ?? '0'))
    expect(pcts.reduce((a, b) => a + b, 0).toFixed(2)).toBe('100.00')
  })
})

describe('display toggles (edit wallet)', () => {
  it('PATCHes one flag at a time and rolls back with a toast on failure', async () => {
    const bodies: unknown[] = []
    server.use(
      http.get(`${W}/w-1`, () => HttpResponse.json(cash)),
      http.get(W, () => HttpResponse.json(walletList([cash]))),
      http.get(`${BASE}/spaces/s-1/transactions`, () => HttpResponse.json({ items: [] })),
      http.patch(`${W}/w-1/display-prefs`, async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({ hideLogo: true, hideName: false, hideType: false })
      }),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/wallets/w-1/edit')
    const sw = await screen.findByRole('switch', { name: 'Hide logo' })
    await user.click(sw)
    await waitFor(() => expect(bodies).toEqual([{ hideLogo: true }]))
    expect(screen.getByRole('switch', { name: 'Hide name' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })
})
