import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BarChart } from './BarChart'
import { LineChart } from './LineChart'

const line = [
  { date: '2026-11-01', value: '100' },
  { date: '2026-11-11', value: '200' },
  { date: '2026-11-21', value: '150' },
]

describe('LineChart inspection (F33-T04)', () => {
  it('has no tooltip until it is inspected, and the chart does not take over vertical scrolling', () => {
    render(<LineChart data={line} currency="USD" label="nw" />)
    expect(screen.queryByTestId('chart-tooltip')).not.toBeInTheDocument()
    const box = screen.getByRole('figure')
    expect(box).toHaveStyle({ touchAction: 'pan-y' })
  })

  it('shows the date and value on pointer move, and the nearest point wins', () => {
    render(<LineChart data={line} currency="USD" label="nw" />)
    const box = screen.getByRole('figure')
    fireEvent.pointerMove(box, { clientX: 0, pointerType: 'mouse' })
    expect(screen.getByTestId('chart-tooltip')).toHaveTextContent('1 Nov')
    expect(screen.getByTestId('chart-tooltip')).toHaveTextContent('$100.00')
    expect(screen.getByTestId('chart-guide')).toBeInTheDocument()
    fireEvent.pointerMove(box, { clientX: 400, pointerType: 'mouse' })
    expect(screen.getByTestId('chart-tooltip')).toHaveTextContent('21 Nov')
    fireEvent.pointerLeave(box, { pointerType: 'mouse' })
    expect(screen.queryByTestId('chart-tooltip')).not.toBeInTheDocument()
  })

  it('moves with the arrow keys and announces the value', async () => {
    const user = userEvent.setup()
    render(<LineChart data={line} currency="USD" label="nw" />)
    await user.tab()
    expect(screen.getByRole('figure')).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByTestId('chart-readout')).toHaveTextContent('1 Nov: $100.00')
    await user.keyboard('{ArrowRight}')
    expect(screen.getByTestId('chart-readout')).toHaveTextContent('11 Nov: $200.00')
    await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}')
    expect(screen.getByTestId('chart-readout')).toHaveTextContent('1 Nov')
    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('chart-tooltip')).not.toBeInTheDocument()
  })
})

describe('BarChart inspection and legend (F33-T04, T18)', () => {
  const groups = [
    { label: 'Week 1', income: '100', expense: '40' },
    { label: 'Week 2', income: '0', expense: '70' },
  ]
  it('shows the bucket label with income and expense on keyboard inspection', async () => {
    const user = userEvent.setup()
    render(<BarChart groups={groups} currency="USD" label="bars" />)
    await user.tab()
    await user.keyboard('{ArrowRight}')
    const tip = screen.getByTestId('chart-tooltip')
    expect(tip).toHaveTextContent('Week 1')
    expect(tip).toHaveTextContent('$100.00')
    expect(tip).toHaveTextContent('$40.00')
  })
  it('the legend toggles a series, and the last visible series cannot be hidden', async () => {
    const user = userEvent.setup()
    const { container } = render(<BarChart groups={groups} currency="USD" label="bars" />)
    const income = screen.getByRole('button', { name: 'Income' })
    const expense = screen.getByRole('button', { name: 'Expense' })
    expect(income).toHaveAttribute('aria-pressed', 'true')
    expect(container.querySelectorAll('rect[data-kind="income"]').length).toBeGreaterThan(0)
    await user.click(income)
    expect(income).toHaveAttribute('aria-pressed', 'false')
    expect(
      [...container.querySelectorAll('rect[data-kind="income"]')].every(
        (r) => r.getAttribute('height') === '0',
      ),
    ).toBe(true)
    await user.click(expense)
    expect(expense).toHaveAttribute('aria-pressed', 'true') // kept
  })
})
