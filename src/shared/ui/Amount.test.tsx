import { render, screen } from '@testing-library/react'
import { Amount } from './Amount'
import { PrivacyProvider, usePrivacy } from './privacy'

function Reveal() {
  const { setRevealed } = usePrivacy()
  return (
    <button type="button" onClick={() => setRevealed(true)}>
      reveal
    </button>
  )
}

describe('Amount', () => {
  it('renders formatted money when amounts are visible', () => {
    render(<Amount value="1234.5" currency="USD" />)
    expect(screen.getByText('$1,234.50')).toBeInTheDocument()
  })

  it('puts no money string in the DOM when hide-amounts is on (not just CSS blur)', () => {
    const { container } = render(
      <PrivacyProvider initialHidden>
        <Amount value="1234.5" currency="USD" />
      </PrivacyProvider>,
    )
    expect(container.innerHTML).not.toMatch(/1,?234/)
    expect(container.innerHTML).not.toContain('$')
    expect(screen.getByRole('img', { name: 'Amount hidden' })).toBeInTheDocument()
  })

  it('reveals for the session when the eye toggle is used', () => {
    render(
      <PrivacyProvider initialHidden>
        <Reveal />
        <Amount value="10" currency="USD" />
      </PrivacyProvider>,
    )
    expect(screen.queryByText('$10.00')).not.toBeInTheDocument()
    screen.getByText('reveal').click()
    return screen.findByText('$10.00')
  })

  it('colours by sign and always shows the sign glyph', () => {
    render(
      <>
        <Amount value="-5" currency="USD" tone="auto" signDisplay="always" />
        <Amount value="5" currency="USD" tone="auto" signDisplay="always" />
      </>,
    )
    expect(screen.getByText('-$5.00')).toHaveClass('text-negative')
    expect(screen.getByText('+$5.00')).toHaveClass('text-positive')
  })
})
