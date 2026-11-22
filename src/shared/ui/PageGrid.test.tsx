import { render, screen } from '@testing-library/react'
import { PageGrid, Panel } from './PageGrid'

describe('PageGrid / Panel', () => {
  it('is one column by default and 12 columns from lg, with spans per panel', () => {
    render(
      <PageGrid data-testid="grid">
        <Panel span={4} aria-label="a">
          a
        </Panel>
        <Panel span={8} aria-label="b">
          b
        </Panel>
      </PageGrid>,
    )
    expect(screen.getByTestId('grid')).toHaveClass('grid-cols-1', 'lg:grid-cols-12')
    expect(screen.getByLabelText('a')).toHaveClass('lg:col-span-4')
    expect(screen.getByLabelText('b')).toHaveClass('lg:col-span-8')
  })
})
