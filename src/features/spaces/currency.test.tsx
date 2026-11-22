import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { BASE, makeAuthedHandlers, ownerSpace, sharedSpace } from '../../../test/msw/api'
import { server } from '../../../test/msw/server'
import { renderApp } from '../../../test/renderApp'
import { parseRate } from './CurrencyScreen'

describe('parseRate', () => {
  it('accepts a positive decimal and canonicalises it', () => {
    expect(parseRate('16250.5')).toBe('16250.5')
    expect(parseRate(' 0.0000615 ')).toBe('0.0000615')
    expect(parseRate('1')).toBe('1')
  })
  it('rejects zero, negatives, junk and exponents', () => {
    for (const bad of ['0', '0.0', '-1', 'abc', '', '1e5', '1,5', '.5']) {
      expect(parseRate(bad), bad).toBeNull()
    }
  })
})

describe('currency settings', () => {
  it('lists supported currencies and hides manual rates while auto conversion is on', async () => {
    server.use(...makeAuthedHandlers())
    renderApp('/settings/currency')
    expect(await screen.findByText('Indonesian Rupiah')).toBeInTheDocument()
    expect(screen.getByText('US Dollar')).toBeInTheDocument()
    expect(screen.getByText('Exchange rates update automatically.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Manual exchange rates' })).not.toBeInTheDocument()
  })

  it('lets the owner add and remove manual rates when auto conversion is off', async () => {
    let put: { path: string; body: unknown } | undefined
    let rates: Array<{ base: string; quote: string; rate: string }> = [
      { base: 'USD', quote: 'IDR', rate: '16250' },
    ]
    const removed: string[] = []
    server.use(
      http.get(`${BASE}/spaces/s-1/fx/manual-rates`, () => HttpResponse.json(rates)),
      http.put(`${BASE}/spaces/s-1/fx/manual-rates/:base/:quote`, async ({ request, params }) => {
        put = { path: `${params.base}/${params.quote}`, body: await request.json() }
        rates = [...rates, { base: String(params.base), quote: String(params.quote), rate: '0.92' }]
        return HttpResponse.json(rates.at(-1))
      }),
      http.delete(`${BASE}/spaces/s-1/fx/manual-rates/:base/:quote`, ({ params }) => {
        removed.push(`${params.base}/${params.quote}`)
        return new HttpResponse(null, { status: 204 })
      }),
      ...makeAuthedHandlers({ spaces: [{ ...ownerSpace, autoFxConversion: false }] }),
    )
    const user = userEvent.setup()
    renderApp('/settings/currency')
    expect(await screen.findByText('1 USD = 16250 IDR')).toBeInTheDocument()

    // validation first
    await user.click(screen.getByRole('button', { name: 'Save rate' }))
    expect(await screen.findByText('Choose two different currencies.')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('From'), 'USD')
    await user.selectOptions(screen.getByLabelText('To'), 'EUR')
    await user.type(screen.getByLabelText('Rate'), '0')
    await user.click(screen.getByRole('button', { name: 'Save rate' }))
    expect(await screen.findByText('Enter a rate greater than zero.')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Rate'))
    await user.type(screen.getByLabelText('Rate'), '0.92')
    await user.click(screen.getByRole('button', { name: 'Save rate' }))
    await waitFor(() => expect(put).toEqual({ path: 'USD/EUR', body: { rate: '0.92' } }))

    await user.click(screen.getAllByRole('button', { name: 'Remove' })[0] as HTMLElement)
    await waitFor(() => expect(removed).toEqual(['USD/IDR']))
  })

  it('shows members the rates read-only', async () => {
    server.use(
      http.get(`${BASE}/spaces/s-2/fx/manual-rates`, () => HttpResponse.json([])),
      ...makeAuthedHandlers({
        lastActiveSpaceId: 's-2',
        spaces: [ownerSpace, { ...sharedSpace, autoFxConversion: false }],
      }),
    )
    renderApp('/settings/currency')
    const section = (await screen.findByRole('heading', { name: 'Manual exchange rates' })).closest(
      'section',
    ) as HTMLElement
    expect(within(section).queryByRole('button', { name: 'Save rate' })).not.toBeInTheDocument()
    expect(
      within(section).getByText(/Only the space owner can change exchange rates/),
    ).toBeInTheDocument()
  })
})
