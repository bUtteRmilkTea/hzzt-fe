import { render, screen } from '@testing-library/react'
import { Collapsible } from './Collapsible'
import { TwoColumn } from './TwoColumn'

describe('TwoColumn', () => {
  it('is two independent flex columns from lg, never a stretching grid', () => {
    render(<TwoColumn data-testid="t" left={<p>L</p>} right={<p>R</p>} />)
    const t = screen.getByTestId('t')
    expect(t).toHaveClass('flex-col', 'lg:flex-row', 'lg:items-start')
    expect(t).not.toHaveClass('grid')
    expect(t.querySelector('[data-column="left"]')).toHaveTextContent('L')
    expect(t.querySelector('[data-column="right"]')).toHaveTextContent('R')
  })
})

describe('Collapsible', () => {
  it('animates the grid row and makes closed content inert', () => {
    const { rerender } = render(
      <Collapsible open={false} data-testid="c">
        <button type="button">inside</button>
      </Collapsible>,
    )
    expect(screen.getByTestId('c')).toHaveClass('grid-rows-[0fr]')
    expect(screen.getByTestId('c')).toHaveAttribute('data-state', 'closed')
    expect(screen.getByText('inside').parentElement).toHaveAttribute('inert')
    rerender(
      <Collapsible open data-testid="c">
        <button type="button">inside</button>
      </Collapsible>,
    )
    expect(screen.getByTestId('c')).toHaveClass('grid-rows-[1fr]')
    expect(screen.getByText('inside').parentElement).not.toHaveAttribute('inert')
  })
})
