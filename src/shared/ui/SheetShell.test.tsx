import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { setMedia } from '../../../test/matchMedia'
import { LayoutProvider } from './layout'
import { SheetShell } from './SheetShell'

/** Vaul keeps the closed drawer mounted (it waits for a CSS transition jsdom never fires). */
function isClosed() {
  const d = document.querySelector('[role=dialog]')
  return !d || d.getAttribute('data-state') === 'closed'
}

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <LayoutProvider>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <SheetShell
        open={open}
        onOpenChange={setOpen}
        title="Sheet title"
        description="desc"
        footer={<button type="button">Confirm</button>}
      >
        <input aria-label="Note" />
      </SheetShell>
    </LayoutProvider>
  )
}

describe.each([
  ['mobile bottom sheet', false],
  ['desktop side drawer', true],
])('SheetShell as %s', (_name, desktop) => {
  beforeEach(() => setMedia({ desktop }))

  it('opens, shows title and sticky footer, and closes with the close button', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(isClosed()).toBe(true)

    await user.click(screen.getByText('open'))
    expect(await screen.findByRole('dialog', { name: 'Sheet title' })).toBeInTheDocument()
    expect(screen.getByText('Confirm')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(isClosed()).toBe(true))
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('open'))
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(isClosed()).toBe(true))
  })

  // jsdom does not move focus into Vaul's drawer; the mobile focus trap is covered in e2e.
  it.skipIf(!desktop)('moves focus into the sheet when it opens', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('open'))
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true), {
      timeout: 4000,
    })
  })
})

describe('SheetShell breakpoints (S2)', () => {
  it('uses a bottom sheet between 768 and 1023px and a right drawer from 1024px', async () => {
    const user = userEvent.setup()
    setMedia({ desktop: true, wide: false })
    const { unmount } = render(<Harness />)
    await user.click(screen.getByText('open'))
    const sheet = await screen.findByRole('dialog')
    expect(sheet.className).toContain('bottom-0')
    unmount()
    setMedia({ desktop: true, wide: true })
    render(<Harness />)
    await user.click(screen.getByText('open'))
    expect((await screen.findByRole('dialog')).className).toContain('right-0')
  })
})
