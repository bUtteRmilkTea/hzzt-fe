import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { MoneyInput } from './MoneyInput'

function Harness({ mode }: { mode?: 'calculator' | 'numeric' }) {
  const [v, setV] = useState('')
  return (
    <>
      <MoneyInput value={v} onChange={setV} currency="USD" mode={mode} />
      <p data-testid="out">{v}</p>
    </>
  )
}

describe('MoneyInput calculator', () => {
  it('0.1 + 0.2 emits exactly 0.3', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    for (const name of ['0', 'Decimal point', '1', 'Plus', '0', 'Decimal point', '2']) {
      await user.click(screen.getByRole('button', { name }))
    }
    expect(screen.getByTestId('out')).toHaveTextContent('0.3')
  })

  it('shows the operators as glyphs and supports clear', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: '6' }))
    await user.click(screen.getByRole('button', { name: 'Multiply' }))
    await user.click(screen.getByRole('button', { name: '7' }))
    expect(screen.getByText('6×7')).toBeInTheDocument()
    expect(screen.getByTestId('out')).toHaveTextContent('42')
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByTestId('out')).toHaveTextContent('')
  })

  it('ignores a dangling operator in the emitted value', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: '5' }))
    await user.click(screen.getByRole('button', { name: 'Plus' }))
    expect(screen.getByTestId('out')).toHaveTextContent('5')
  })
})

describe('MoneyInput numeric', () => {
  it('normalises to the currency minor units on blur', async () => {
    const user = userEvent.setup()
    render(<Harness mode="numeric" />)
    const input = screen.getByRole('textbox')
    await user.type(input, '1.005')
    await user.tab()
    expect(input).toHaveValue('1.01')
    expect(screen.getByTestId('out')).toHaveTextContent('1.01')
  })
})
