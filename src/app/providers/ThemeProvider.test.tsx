import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setMedia } from '../../../test/matchMedia'
import { resolveTheme, ThemeProvider, useTheme } from './ThemeProvider'

function Probe() {
  const { theme, resolved, setTheme } = useTheme()
  return (
    <>
      <span data-testid="state">
        {theme}/{resolved}
      </span>
      <button type="button" onClick={() => setTheme('light')}>
        light
      </button>
      <button type="button" onClick={() => setTheme('dark')}>
        dark
      </button>
    </>
  )
}

describe('resolveTheme', () => {
  it('follows the system only when the choice is system', () => {
    expect(resolveTheme('system', true)).toBe('light')
    expect(resolveTheme('system', false)).toBe('dark')
    expect(resolveTheme('dark', true)).toBe('dark')
    expect(resolveTheme('light', false)).toBe('light')
  })
})

describe('ThemeProvider', () => {
  it('defaults to dark when the system is dark', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('state')).toHaveTextContent('system/dark')
    expect(document.documentElement).not.toHaveAttribute('data-theme')
  })

  it('follows a light system setting', () => {
    setMedia({ light: true })
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })

  it('applies the choice, persists it, and a remount keeps it', async () => {
    const user = userEvent.setup()
    const first = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    await user.click(screen.getByText('light'))
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(localStorage.getItem('theme')).toBe('light')
    first.unmount()

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('state')).toHaveTextContent('light/light')
  })

  it('ignores garbage in storage', () => {
    localStorage.setItem('theme', 'banana')
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('state')).toHaveTextContent('system/dark')
  })
})
