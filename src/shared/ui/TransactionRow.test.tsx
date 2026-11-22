import { render, screen } from '@testing-library/react'
import { type TransactionDTO, TransactionRow } from './TransactionRow'

const base: TransactionDTO = {
  id: '1',
  title: 'Lunch',
  amount: '12.5',
  currency: 'USD',
  direction: 'OUT',
  type: 'EXPENSE',
}

describe('TransactionRow amount tone', () => {
  it('colours expense amounts red', () => {
    render(<TransactionRow transaction={base} />)
    expect(screen.getByText('-$12.50')).toHaveClass('text-negative')
  })
  it('colours income green and leaves transfers neutral', () => {
    const { rerender } = render(
      <TransactionRow transaction={{ ...base, type: 'INCOME', direction: 'IN' }} />,
    )
    expect(screen.getByText('$12.50')).toHaveClass('text-positive')
    rerender(<TransactionRow transaction={{ ...base, type: 'TRANSFER', direction: 'OUT' }} />)
    const el = screen.getByText('-$12.50')
    expect(el).not.toHaveClass('text-negative')
    expect(el).not.toHaveClass('text-positive')
  })
})
