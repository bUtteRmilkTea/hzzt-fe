import { render, screen } from '@testing-library/react'
import { Button, DisabledReason } from './Button'

describe('Button disabled state (F37-T03)', () => {
  it('has aria-disabled with disabled, and a linked reason', () => {
    render(
      <>
        <Button disabled aria-describedby="why">
          Save
        </Button>
        <DisabledReason id="why">Fill in the name</DisabledReason>
      </>,
    )
    const b = screen.getByRole('button', { name: 'Save' })
    expect(b).toBeDisabled()
    expect(b).toHaveAttribute('aria-disabled', 'true')
    expect(b.className).toContain('disabled:bg-surface-3')
    expect(b.className).toContain('disabled:cursor-not-allowed')
    expect(b).toHaveAccessibleDescription('Fill in the name')
  })
  it('an enabled button has no aria-disabled', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).not.toHaveAttribute('aria-disabled')
  })
})
