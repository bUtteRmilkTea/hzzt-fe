import { render, screen } from '@testing-library/react'
import { Page } from './Page'

describe('Page', () => {
  it('uses the wide tier by default and the form tier on request, both from tokens', () => {
    render(
      <>
        <Page data-testid="wide">a</Page>
        <Page width="form" data-testid="form">
          b
        </Page>
      </>,
    )
    expect(screen.getByTestId('wide')).toHaveClass('mx-auto', 'max-w-[var(--page-max-wide)]')
    expect(screen.getByTestId('form')).toHaveClass('max-w-[var(--page-max-form)]')
    expect(screen.getByTestId('form')).not.toHaveClass('max-w-[var(--page-max-wide)]')
  })

  it('lets a caller override direction and gap', () => {
    render(<Page data-testid="p" gap={6} className="flex-row" />)
    expect(screen.getByTestId('p')).toHaveClass('flex-row', 'gap-6')
    expect(screen.getByTestId('p')).not.toHaveClass('flex-col')
  })
})
