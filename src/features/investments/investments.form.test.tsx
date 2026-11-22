// biome-ignore-all lint/plugin: fixtures only
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setMedia } from '../../../test/matchMedia'
import { BASE, makeAuthedHandlers } from '../../../test/msw/api'
import { list, metas } from '../../../test/msw/investments'
import { server } from '../../../test/msw/server'
import { renderApp } from '../../../test/renderApp'

beforeEach(() => {
  server.use(...makeAuthedHandlers())
  server.use(
    http.get(`${BASE}/investment-types`, () => HttpResponse.json(metas)),
    http.get(`${BASE}/spaces/s-1/investments`, () => HttpResponse.json(list([]))),
  )
})
afterEach(() => setMedia({ desktop: false, wide: false }))

const open = async () => {
  renderApp('/s/s-1/investments/new')
  await screen.findByLabelText('Type')
}

/** The two-column grid that holds a field, found through its label. */
const gridOf = (label: string) => screen.getByLabelText(label).closest('.grid') as HTMLElement

describe('add investment layout (F13-T05, T06)', () => {
  it('pairs quantity with average price, and current price with fees, in a two-column grid from lg', async () => {
    await open()
    const user = userEvent.setup()
    await user.click(screen.getByRole('radio', { name: 'Manual' }))
    const grid = gridOf('Quantity')
    expect(grid).toHaveClass('grid-cols-1', 'lg:grid-cols-2')
    const order = [...grid.querySelectorAll('label')].map((l) => l.textContent)
    const at = (t: string) => order.findIndex((o) => o?.startsWith(t))
    // Quantity | Average buy price, then Current price | Fees: neighbours in the grid flow.
    expect(at('Average buy price')).toBe(at('Quantity') + 1)
    expect(at('Fees')).toBe(at('Current price') + 1)
    expect(Math.floor(at('Quantity') / 2)).toBe(Math.floor(at('Average buy price') / 2))
    expect(Math.floor(at('Current price') / 2)).toBe(Math.floor(at('Fees') / 2))
  })

  it('hides the 24-emoji grid behind the icon tile until it is opened, then closes on Escape', async () => {
    await open()
    const user = userEvent.setup()
    expect(screen.queryByRole('button', { name: 'Emoji 💰' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Custom emoji')).not.toBeInTheDocument()

    const tile = screen.getByRole('button', { name: /^Icon: .*, change$/ })
    expect(tile).toHaveAttribute('aria-expanded', 'false')
    await user.click(tile)
    const popover = await screen.findByRole('dialog', { name: 'Choose icon' })
    await user.click(within(popover).getByRole('button', { name: 'Emoji 💰' }))
    expect(tile).toHaveTextContent('💰')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Choose icon' })).not.toBeInTheDocument()
    expect(tile).toHaveFocus()
  })

  it('keeps the Add button in a sticky bar, so it is reachable without scrolling', async () => {
    await open()
    const bar = screen.getByTestId('submit-bar')
    expect(bar).toHaveClass('sticky', 'bottom-24', 'md:bottom-0')
    expect(within(bar).getByRole('button', { name: 'Add investment' })).toBeInTheDocument()
  })

  it('echoes the name, symbol and icon in a rail, with no computed totals', async () => {
    await open()
    const user = userEvent.setup()
    const rail = screen.getByTestId('summary-rail')
    expect(within(rail).getByTestId('rail-name')).toHaveTextContent('Name') // placeholder
    await user.type(screen.getByLabelText('Name'), 'Bitcoin')
    await user.type(screen.getByLabelText('Symbol'), 'btc')
    await user.type(screen.getByLabelText('Quantity'), '2')
    await user.type(screen.getByLabelText('Average buy price'), '100')
    expect(within(rail).getByTestId('rail-name')).toHaveTextContent('Bitcoin')
    expect(within(rail).getByTestId('rail-symbol')).toHaveTextContent('btc')
    await user.click(screen.getByRole('button', { name: /^Icon: .*, change$/ }))
    await user.click(await screen.findByRole('button', { name: 'Emoji 🪙' }))
    expect(rail).toHaveTextContent('🪙')
    // 2 x 100 = 200 must never appear: the client does not compute money.
    expect(rail.textContent).not.toMatch(/200/)
    // The rail only shows from lg, so phones keep a single column.
    expect(rail).toHaveClass('hidden', 'lg:flex')
  })
})
