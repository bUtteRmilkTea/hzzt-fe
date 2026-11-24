// biome-ignore-all lint/plugin: fixtures only
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { BASE, errorEnvelope, makeAuthedHandlers } from '../../../test/msw/api'
import { btc, list, metas } from '../../../test/msw/investments'
import { server } from '../../../test/msw/server'
import { bank, cash, walletList } from '../../../test/msw/wallets'
import { renderApp } from '../../../test/renderApp'
import { deleteSummary } from './TradeHistory'

const I = `${BASE}/spaces/s-1/investments`

const pos = (quantity: string, avgBuyPrice: string) => ({ quantity, avgBuyPrice, fees: '0' })

const second = {
  id: 't-2',
  action: 'BUY',
  occurredAt: '2026-11-10T09:00:00Z',
  quantity: '0.2',
  unitPrice: '60000',
  fee: '0',
  amount: '12000',
  currency: 'USD',
  walletId: 'w-1',
  walletName: 'Main wallet',
  positionBefore: pos('1', '50000'),
  positionAfter: pos('1.2', '51666.67'),
  canDelete: true,
}
const first = {
  id: 't-1',
  action: 'BUY',
  occurredAt: '2026-11-01T09:00:00Z',
  quantity: '1',
  unitPrice: '50000',
  fee: '0',
  amount: '50000',
  currency: 'USD',
  walletId: 'w-1',
  walletName: 'Main wallet',
  positionBefore: pos('0', '0'),
  positionAfter: pos('1', '50000'),
  canDelete: true,
}
const sale = {
  id: 't-3',
  action: 'SELL',
  occurredAt: '2026-11-15T09:00:00Z',
  quantity: '0.5',
  unitPrice: '70000',
  fee: '0',
  amount: '35000',
  currency: 'USD',
  walletId: 'w-1',
  walletName: 'Main wallet',
  realizedPl: '9166.67',
  positionBefore: pos('1.2', '51666.67'),
  positionAfter: pos('0.7', '51666.67'),
  canDelete: true,
}

const page = (items: unknown[], extra: Record<string, unknown> = {}) => ({
  items,
  next: null,
  openingPosition: { quantity: '0', avgBuyPrice: '0' },
  ...extra,
})

describe('deleteSummary uses the row own figures', () => {
  it('names the position and wallet effect of the trade that made the position', () => {
    const text = deleteSummary(second as never, 'USD', true)
    expect(text).toContain('Delete this buy of 0.2')
    expect(text).toContain(
      'Your position goes from 1.2 to 1, average price from 51666.67 to 50000 USD.',
    )
    expect(text).toContain('12000 USD is returned to Main wallet.')
  })
  it('promises no figure for an older trade, which the server replays', () => {
    const text = deleteSummary(first as never, 'USD', false)
    expect(text).toContain('recalculated without this trade')
    expect(text).not.toContain('goes from')
  })
  it('a sale takes the money back from the wallet', () => {
    expect(deleteSummary(sale as never, 'USD', true)).toContain('taken back from Main wallet')
  })
})

describe('trade history on the investment detail', () => {
  beforeEach(() =>
    server.use(
      ...makeAuthedHandlers(),
      http.get(`${BASE}/investment-types`, () => HttpResponse.json(metas)),
      http.get(`${BASE}/spaces/s-1/wallets`, () => HttpResponse.json(walletList([cash, bank]))),
      http.get(I, () => HttpResponse.json(list([btc]))),
      http.get(`${I}/i-1`, () =>
        HttpResponse.json({ ...btc, quantity: '0.7', avgBuyPrice: '51666.67' }),
      ),
    ),
  )

  it('lists the trades with realised PnL on a sale and the opening position at the end', async () => {
    server.use(
      http.get(`${I}/i-1/trades`, () =>
        HttpResponse.json(
          page([sale, second, first], {
            openingPosition: { quantity: '0.5', avgBuyPrice: '40000' },
          }),
        ),
      ),
    )
    renderApp('/s/s-1/investments/i-1')
    const rows = await screen.findAllByTestId('trade-row')
    expect(rows).toHaveLength(3)
    expect(within(rows[0] as HTMLElement).getByText(/Sell 0.5/)).toBeInTheDocument()
    expect(within(rows[0] as HTMLElement).getByTestId('trade-realized')).toHaveTextContent(
      '9,166.67',
    )
    expect(within(rows[1] as HTMLElement).queryByTestId('trade-realized')).not.toBeInTheDocument()
    expect(screen.getByTestId('opening')).toHaveTextContent('Started with 0.5 at')
  })

  it('shows an empty state and no opening line for a zero start', async () => {
    server.use(http.get(`${I}/i-1/trades`, () => HttpResponse.json(page([]))))
    renderApp('/s/s-1/investments/i-1')
    expect(await screen.findByText('No trades yet. Use Buy or Sell.')).toBeInTheDocument()
    expect(screen.queryByTestId('opening')).not.toBeInTheDocument()
  })

  it('loads the next page with the cursor', async () => {
    const seen: Array<string | null> = []
    server.use(
      http.get(`${I}/i-1/trades`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor')
        seen.push(cursor)
        return HttpResponse.json(cursor ? page([first]) : page([sale], { next: 'c-2' }))
      }),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/investments/i-1')
    await screen.findAllByTestId('trade-row')
    await user.click(screen.getByRole('button', { name: 'Load more' }))
    await waitFor(() => expect(screen.getAllByTestId('trade-row')).toHaveLength(2))
    expect(seen).toEqual([null, 'c-2'])
  })

  it('deleting the trade that made the position states the effect, then refreshes', async () => {
    const deleted = vi.fn()
    let calls = 0
    server.use(
      http.get(`${I}/i-1/trades`, () => {
        calls++
        return HttpResponse.json(page(calls === 1 ? [sale, second, first] : [second, first]))
      }),
      http.delete(`${BASE}/spaces/s-1/transfers/t-3`, () => {
        deleted()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/investments/i-1')
    const del = await screen.findByRole('button', { name: /Delete sale of 0.5 on 15 Nov 2026/ })
    await user.click(del)
    const dialog = await screen.findByRole('dialog', { name: 'Delete this trade?' })
    expect(dialog).toHaveTextContent('Your position goes from 0.7 to 1.2')
    expect(dialog).toHaveTextContent('35000 USD is taken back from Main wallet.')
    await user.click(within(dialog).getByRole('button', { name: 'Delete trade' }))
    await waitFor(() => expect(deleted).toHaveBeenCalled())
    await waitFor(() => expect(screen.getAllByTestId('trade-row')).toHaveLength(2))
  })

  it('a refused delete explains and points at the sale that needs the trade', async () => {
    server.use(
      http.get(`${I}/i-1/trades`, () => HttpResponse.json(page([sale, first]))),
      http.delete(`${BASE}/spaces/s-1/transfers/t-1`, () =>
        HttpResponse.json(
          errorEnvelope('TRADE_DELETE_BREAKS_LATER_SELL', 'x', { tradeId: 't-3' }),
          { status: 422 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/investments/i-1')
    await user.click(await screen.findByRole('button', { name: /Delete buy of 1 on 1 Nov 2026/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete this trade?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete trade' }))
    // The closing dialog keeps the app hidden to role queries in jsdom, so look it up by text.
    expect(await screen.findByText(/pays for a later sale/)).toBeInTheDocument()
    expect(screen.getByText('Show that sale')).toBeInTheDocument()
  })

  it('a trade already gone (404) refetches instead of failing', async () => {
    let calls = 0
    server.use(
      http.get(`${I}/i-1/trades`, () => {
        calls++
        return HttpResponse.json(page(calls === 1 ? [sale] : []))
      }),
      http.delete(`${BASE}/spaces/s-1/transfers/t-3`, () =>
        HttpResponse.json(errorEnvelope('TRANSACTION_NOT_FOUND', 'gone'), { status: 404 }),
      ),
    )
    const user = userEvent.setup()
    renderApp('/s/s-1/investments/i-1')
    await user.click(await screen.findByRole('button', { name: /Delete sale/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete this trade?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete trade' }))
    expect(await screen.findByText('No trades yet. Use Buy or Sell.')).toBeInTheDocument()
  })

  it('a blocked row shows the reason instead of a delete button', async () => {
    server.use(
      http.get(`${I}/i-1/trades`, () =>
        HttpResponse.json(
          page([{ ...first, canDelete: false, blockedReason: 'POSITION_CHANGED_SINCE' }]),
        ),
      ),
    )
    renderApp('/s/s-1/investments/i-1')
    expect(await screen.findByText('The position was edited after this trade.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Delete buy/ })).not.toBeInTheDocument()
  })

  it('is read only for an investment shared with you', async () => {
    server.use(
      http.get(`${I}/i-1`, () => HttpResponse.json({ ...btc, ownership: 'SHARED_IN' })),
      http.get(`${I}/i-1/trades`, () => HttpResponse.json(page([first]))),
    )
    renderApp('/s/s-1/investments/i-1')
    await screen.findAllByTestId('trade-row')
    expect(screen.queryByRole('button', { name: /Delete buy/ })).not.toBeInTheDocument()
  })

  it('shows Try again when the history cannot load', async () => {
    server.use(
      http.get(`${I}/i-1/trades`, () =>
        HttpResponse.json(errorEnvelope('INTERNAL_ERROR'), { status: 500 }),
      ),
    )
    renderApp('/s/s-1/investments/i-1')
    expect(await screen.findByText("Couldn't load the history.")).toBeInTheDocument()
  })
})
