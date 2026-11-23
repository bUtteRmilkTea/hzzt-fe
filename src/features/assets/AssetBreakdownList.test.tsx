import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AssetBreakdownList, type BreakdownGroup } from './AssetBreakdownList'

const row = (key: string) => ({ key, name: `Row ${key}`, value: '100', currency: 'IDR' })
const group = (key: string, rows: number): BreakdownGroup => ({
  key,
  title: key,
  rows: Array.from({ length: rows }, (_, i) => row(`${key}${i}`)),
})

describe('AssetBreakdownList toggles (F35-T01)', () => {
  it.each([1, 2])('a titled group with %i row(s) has a working toggle', async (n) => {
    render(<AssetBreakdownList collapsible groups={[group('Binance', n)]} />)
    const toggle = screen.getByRole('button', { name: /Binance/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('renders nothing for a group with 0 rows', () => {
    render(<AssetBreakdownList collapsible groups={[group('Empty', 0)]} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('an untitled group never toggles', () => {
    render(<AssetBreakdownList collapsible groups={[{ ...group('x', 2), title: undefined }]} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('without collapsible nothing toggles', () => {
    render(<AssetBreakdownList groups={[group('Binance', 1)]} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
