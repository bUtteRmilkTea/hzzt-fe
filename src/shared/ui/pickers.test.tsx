// biome-ignore-all lint/plugin: hex strings here are test inputs for the colour picker
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { ColorPicker } from './ColorPicker'
import { EmojiPicker } from './EmojiPicker'
import { HEX_COLOR, PALETTE } from './palette'
import { WarningsStrip } from './WarningsStrip'

function Colour() {
  const [v, setV] = useState(PALETTE[0] as string)
  return (
    <>
      <ColorPicker value={v} onChange={setV} />
      <output data-testid="v">{v}</output>
    </>
  )
}

describe('ColorPicker', () => {
  it('picks a swatch', async () => {
    const user = userEvent.setup()
    render(<Colour />)
    await user.click(screen.getByRole('button', { name: `Colour ${PALETTE[3]}` }))
    expect(screen.getByTestId('v')).toHaveTextContent(PALETTE[3])
  })
  it('accepts only a valid custom hex', async () => {
    const user = userEvent.setup()
    render(<Colour />)
    const input = screen.getByLabelText('Custom hex colour')
    await user.type(input, '#12')
    expect(screen.getByTestId('v')).toHaveTextContent(PALETTE[0])
    expect(input).toHaveAttribute('aria-invalid', 'true')
    await user.type(input, '34ab')
    expect(screen.getByTestId('v')).toHaveTextContent('#1234ab')
    expect(HEX_COLOR.test('#1234ab')).toBe(true)
    expect(HEX_COLOR.test('1234ab')).toBe(false)
  })
})

describe('EmojiPicker', () => {
  it('picks from the grid or a custom emoji', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<EmojiPicker value="🏠" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Emoji 💰' }))
    expect(onChange).toHaveBeenLastCalledWith('💰')
    await user.click(screen.getByLabelText('Custom emoji'))
    await user.paste('🦄')
    expect(onChange).toHaveBeenLastCalledWith('🦄')
  })
})

describe('WarningsStrip', () => {
  it('renders nothing without warnings', () => {
    const { container } = render(<WarningsStrip warnings={[]} />)
    expect(container).toBeEmptyDOMElement()
    const { container: c2 } = render(<WarningsStrip />)
    expect(c2).toBeEmptyDOMElement()
  })
  it('shows each warning message, falling back to its code', () => {
    render(
      <WarningsStrip
        warnings={[
          { code: 'FX_RATE_UNAVAILABLE', message: 'No USD to IDR rate' },
          { code: 'OTHER' },
        ]}
      />,
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('No USD to IDR rate')).toBeInTheDocument()
    expect(screen.getByText('OTHER')).toBeInTheDocument()
  })
})
