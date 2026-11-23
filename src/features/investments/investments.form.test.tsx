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

describe('add investment form rules (F34)', () => {
  beforeEach(() =>
    server.use(http.get(`${BASE}/fx/latest`, () => HttpResponse.json({ rates: {} }))),
  )

  it('a crypto form starts as Auto, an Indonesian stock starts as Manual', async () => {
    await open()
    const user = userEvent.setup()
    expect(screen.getByRole('radio', { name: 'Auto' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Manual' })).not.toBeChecked()
    await user.selectOptions(screen.getByLabelText('Type'), 'ID_STOCK')
    expect(screen.getByRole('radio', { name: 'Manual' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Auto' })).toBeDisabled()
  })

  it('an Indonesian stock priced in IDR has Rp prefixes and no exchange rate field', async () => {
    await open()
    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Type'), 'ID_STOCK')
    const avg = screen.getByLabelText('Average buy price')
    expect(within(avg.parentElement as HTMLElement).getByTestId('input-prefix')).toHaveTextContent(
      'Rp',
    )
    expect(screen.queryByText(/Use my own exchange rate/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Exchange rate/)).not.toBeInTheDocument()
  })

  it('a US stock shows $ prefixes and keeps the typed rate behind a switch', async () => {
    await open()
    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Type'), 'US_STOCK')
    await user.click(screen.getByRole('radio', { name: 'Manual' }))
    const price = screen.getByLabelText('Current price')
    expect(
      within(price.parentElement as HTMLElement).getByTestId('input-prefix'),
    ).toHaveTextContent('$')
    expect(screen.queryByLabelText(/Exchange rate/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('switch', { name: 'Use my own exchange rate' }))
    expect(screen.getByLabelText(/Exchange rate \(1 USD/)).toBeInTheDocument()
  })

  it('a manual value disables the price, with the reason, and the rule line is shown', async () => {
    await open()
    const user = userEvent.setup()
    await user.click(screen.getByRole('radio', { name: 'Manual' }))
    expect(screen.getByTestId('value-rule')).toHaveTextContent(
      'Manual value overrides price × quantity.',
    )
    const price = screen.getByLabelText('Current price')
    expect(price).toBeEnabled()
    await user.type(screen.getByLabelText('Manual current value (optional)'), '5000')
    expect(price).toBeDisabled()
    expect(screen.getByText('Not used while a manual value is set')).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Manual current value (optional)'))
    expect(price).toBeEnabled()
  })

  it('the yearly change is empty by default and never 5.5', async () => {
    await open()
    expect(screen.getByLabelText('Expected yearly change (optional)')).toHaveValue('')
    expect(screen.getByText('Only used for projections. Leave empty for none.')).toBeInTheDocument()
  })
})

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

  it('Add investment is disabled until a name is typed and says why (F37-T03)', async () => {
    await open()
    const user = userEvent.setup()
    const bar = screen.getByTestId('submit-bar')
    const btn = within(bar).getByRole('button', { name: 'Add investment' })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-disabled', 'true')
    expect(btn).toHaveAccessibleDescription('Enter a name to add this investment')
    await user.type(screen.getByLabelText('Name'), 'Bitcoin')
    expect(btn).toBeEnabled()
    expect(btn).not.toHaveAttribute('aria-describedby')
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
