import { render, screen } from '@testing-library/react'
import { BarChart } from './BarChart'
import { DonutChart } from './DonutChart'
import { LineChart } from './LineChart'

const line = [
  { date: '2026-01-01', value: '100' },
  { date: '2026-02-01', value: '150', live: true },
]

describe('LineChart motion', () => {
  it('draws the line with pathLength 1, fades the area and the end dot, only when asked', () => {
    const { container, rerender } = render(<LineChart data={line} currency="USD" label="nw" draw />)
    const path = container.querySelector('path[pathLength="1"]')
    expect(path).toHaveClass('chart-line-draw')
    expect(container.querySelector('.chart-area-in')).not.toBeNull()
    expect(container.querySelector('.chart-dot-in')).not.toBeNull()
    rerender(<LineChart data={line} currency="USD" label="nw" />)
    expect(container.querySelector('.chart-line-draw')).toBeNull()
  })

  it('restarts the drawing when the range (series) changes', () => {
    const { container, rerender } = render(<LineChart data={line} currency="USD" label="nw" draw />)
    const first = container.querySelector('svg')
    rerender(
      <LineChart
        data={[{ date: '2025-08-01', value: '90' }, ...line]}
        currency="USD"
        label="nw"
        draw
      />,
    )
    expect(container.querySelector('svg')).not.toBe(first)
  })

  it('shows a chart-shaped skeleton while loading and a dot for a single point', () => {
    const { rerender } = render(<LineChart loading data={[]} currency="USD" label="nw" />)
    expect(screen.getByTestId('line-chart-skeleton')).toBeInTheDocument()
    rerender(
      <LineChart data={[{ date: '2026-01-01', value: '5' }]} currency="USD" label="nw" draw />,
    )
    expect(screen.getByTestId('line-chart').querySelector('circle')).not.toBeNull()
  })
})

describe('BarChart and DonutChart motion', () => {
  it('staggers bars per group, income and expense together', () => {
    const { container } = render(
      <BarChart
        label="b"
        currency="USD"
        draw
        groups={[
          { label: 'A', income: '10', expense: '5' },
          { label: 'B', income: '20', expense: '1' },
        ]}
      />,
    )
    const bars = [...container.querySelectorAll('rect.chart-bar')] as SVGElement[]
    expect(bars.map((b) => b.style.getPropertyValue('--i'))).toEqual(['0', '0', '1', '1'])
  })

  it('sweeps slices in and renders the exact centre count when not animating', () => {
    const slices = [
      { key: 'a', name: 'A', amount: '10', color: 'red', pct: '50.00', count: 2 },
      { key: 'b', name: 'B', amount: '10', color: 'blue', pct: '50.00', count: 3 },
    ]
    const { container, rerender } = render(
      <DonutChart
        slices={slices}
        currency="USD"
        label="d"
        centre={{ value: '5', caption: 'tx' }}
        draw
      />,
    )
    expect(container.querySelectorAll('path.chart-slice')).toHaveLength(2)
    rerender(
      <DonutChart
        slices={slices}
        currency="USD"
        label="d"
        centre={{ value: '5', caption: 'tx' }}
      />,
    )
    expect(container.querySelector('path.chart-slice')).toBeNull()
    expect(container.querySelector('text')?.textContent).toBe('5')
  })
})
