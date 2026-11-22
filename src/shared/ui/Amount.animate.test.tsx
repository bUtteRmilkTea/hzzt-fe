import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { Amount } from './Amount'
import { PrivacyProvider } from './privacy'
import { interpolateMoney } from './useCountUp'

// A manual requestAnimationFrame so frames are deterministic.
let queue: Array<(t: number) => void> = []
function step(ts: number) {
  const q = queue
  queue = []
  act(() => {
    for (const cb of q) cb(ts)
  })
}
beforeEach(() => {
  queue = []
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => queue.push(cb))
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
})
afterEach(() => vi.unstubAllGlobals())

describe('interpolateMoney', () => {
  it('uses Decimal and ends on exactly the server string', () => {
    expect(interpolateMoney('0', '134.26', 1)).toBe('134.26')
    expect(interpolateMoney('0', '134.26', 0)).toBe('0')
    expect(interpolateMoney('0', '134.26', 0.5)).toBe('67.13')
    // Beyond double precision: a Number() path would corrupt this.
    expect(interpolateMoney('0', '9007199254740993.01', 1)).toBe('9007199254740993.01')
  })
})

describe('<Amount animate>', () => {
  it('counts up from 0 and its last frame is exactly the formatted server value', () => {
    const { container } = render(<Amount value="134.26" currency="USD" animate />)
    const visible = () => container.querySelector('[aria-hidden]:not(.invisible)')?.textContent
    expect(visible()).toBe('$0.00')
    step(1000)
    step(1350)
    const mid = visible()
    expect(mid).not.toBe('$0.00')
    expect(mid).not.toBe('$134.26')
    step(1700)
    expect(visible()).toBe('$134.26')
    expect(queue).toHaveLength(0)
  })

  it('exposes only the final value to screen readers, at every frame', () => {
    const { container } = render(<Amount value="134.26" currency="USD" animate />)
    step(1000)
    step(1300)
    expect(container.querySelector('.sr-only')?.textContent).toBe('$134.26')
  })

  it('counts again from the old value when the value changes', () => {
    const { container, rerender } = render(<Amount value="100" currency="USD" animate />)
    step(0)
    step(5000)
    rerender(<Amount value="200" currency="USD" animate />)
    step(6000)
    step(6350)
    const mid = container.querySelector('[aria-hidden]:not(.invisible)')?.textContent
    expect(mid).not.toBe('$100.00')
    expect(mid).not.toBe('$200.00')
    step(7000)
    expect(container.querySelector('[aria-hidden]:not(.invisible)')?.textContent).toBe('$200.00')
  })

  it('is instant under reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const { container } = render(<Amount value="134.26" currency="USD" animate />)
    expect(container.querySelector('[aria-hidden]:not(.invisible)')?.textContent).toBe('$134.26')
    expect(queue).toHaveLength(0)
  })

  it('never puts a digit in the DOM while hidden, at any frame, and starts no animation', () => {
    const { container } = render(
      <PrivacyProvider initialHidden>
        <Amount value="134.26" currency="USD" animate />
      </PrivacyProvider>,
    )
    for (const ts of [0, 100, 350, 700, 1500]) {
      step(ts)
      // Compare text and accessible names, not class names (`blur-[2px]` has a digit).
      const exposed = `${container.textContent}${container.querySelector('[aria-label]')?.getAttribute('aria-label')}`
      expect(exposed).not.toMatch(/\d/)
      expect(container.innerHTML).not.toContain('$')
      expect(container.querySelector('[data-masked]')).not.toBeNull()
    }
    expect(queue).toHaveLength(0)
  })
})
