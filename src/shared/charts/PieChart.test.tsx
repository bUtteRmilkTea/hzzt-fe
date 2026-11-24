import { render, screen, within } from '@testing-library/react'
import { donutGeometry, MIN_SLICE_DEG } from './geometry'
import { PieChart } from './PieChart'

const slices = Array.from({ length: 25 }, (_, i) => ({
  key: `k${i}`,
  name: `Holding ${i}`,
  amount: String(1000 - i * 10),
}))

describe('PieChart legend (D-F55)', () => {
  it('lists every slice, with no Other row', () => {
    render(<PieChart slices={slices} currency="IDR" label="Split" />)
    expect(within(screen.getByTestId('pie-legend')).getAllByRole('listitem')).toHaveLength(25)
    expect(screen.queryByText('Other')).not.toBeInTheDocument()
  })

  it('with a max height the legend is a named, focusable scroll region that keeps its scroll', () => {
    render(<PieChart slices={slices} currency="IDR" label="Split" legendMaxHeight={320} />)
    const region = screen.getByRole('region', { name: 'Split legend, scrollable' })
    expect(region).toHaveAttribute('tabindex', '0')
    expect(region).toHaveStyle({ maxHeight: '320px' })
    expect(region).toHaveClass('overflow-y-auto', 'overscroll-contain')
  })

  it('shows a second legend line when a slice has detail', () => {
    render(
      <PieChart
        slices={[
          {
            key: 'a',
            name: 'BTC, 2 accounts',
            amount: '10',
            detail: 'Binance 60.00%, Hyperliquid 40.00%',
          },
        ]}
        currency="IDR"
        label="Split"
      />,
    )
    expect(screen.getByText('Binance 60.00%, Hyperliquid 40.00%')).toBeInTheDocument()
  })

  it('draws a tiny holding at a minimum angle while the legend keeps its true share', () => {
    const arcs = donutGeometry(
      [
        { key: 'big', amount: '100000' },
        { key: 'tiny', amount: '1' },
      ],
      80,
      0,
    )
    const tiny = arcs.find((a) => a.key === 'tiny')
    expect(
      ((tiny?.endAngle ?? 0) - (tiny?.startAngle ?? 0)) * (180 / Math.PI),
    ).toBeGreaterThanOrEqual(MIN_SLICE_DEG * 0.99 - 0.02 * (180 / Math.PI))
    render(
      <PieChart
        slices={[
          { key: 'big', name: 'Big', amount: '100000' },
          { key: 'tiny', name: 'Tiny', amount: '1' },
        ]}
        currency="IDR"
        label="Split"
      />,
    )
    expect(screen.getByText('0.00%')).toBeInTheDocument()
  })
})
