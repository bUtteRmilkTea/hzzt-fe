import { act, render, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Amount } from '@/shared/ui/Amount'
import { countDuration } from '@/shared/ui/useCountUp'
import { applyMotionPref, readMotionPref, writeMotionPref } from './motionPref'
import { prefersReducedMotion } from './timings'
import { useInView } from './useInView'

let queue: Array<(t: number) => void> = []
const step = (ts: number) => {
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
afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  applyMotionPref('system')
})

describe('count up and down (F16-T02)', () => {
  it('a decrease counts down through values between the old and new, ending exactly on the new one', () => {
    const { container, rerender } = render(<Amount value="1000" currency="USD" animate />)
    const frame = () => container.querySelector('[data-frame]')?.getAttribute('data-frame')
    step(0)
    step(5000) // first view settles on 1000
    expect(frame()).toBe('$1,000.00')
    rerender(<Amount value="400" currency="USD" animate />)
    step(6000)
    step(6250)
    const mid = Number((frame() ?? '').replace(/[^0-9.]/g, ''))
    expect(mid).toBeGreaterThan(400)
    expect(mid).toBeLessThan(1000)
    step(8000)
    expect(frame()).toBe('$400.00')
  })

  it('scales the duration with the size of the change (400 to 900 ms)', () => {
    expect(countDuration('1000', '1001')).toBeLessThan(420)
    expect(countDuration('1000', '0')).toBe(900)
    expect(countDuration('0', '0')).toBe(700)
    expect(countDuration('100', '150')).toBeGreaterThan(400)
    expect(countDuration('100', '150')).toBeLessThan(900)
  })
})

describe('useInView (D-F20)', () => {
  it('is true at once where IntersectionObserver is missing, and when disabled', () => {
    expect(renderHook(() => useInView(true)).result.current[1]).toBe(true)
    expect(renderHook(() => useInView(false)).result.current[1]).toBe(true)
  })

  it('stays false until the element intersects, then stays true', () => {
    let cb: IntersectionObserverCallback = () => {}
    const observe = vi.fn()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(c: IntersectionObserverCallback) {
          cb = c
        }
        observe = observe
        disconnect = vi.fn()
      },
    )
    const { result } = renderHook(() => useInView(true))
    act(() => result.current[0](document.createElement('div')))
    expect(observe).toHaveBeenCalled()
    expect(result.current[1]).toBe(false)
    act(() =>
      cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver),
    )
    expect(result.current[1]).toBe(true)
  })

  it('holds a counter at its first frame until it is on screen', () => {
    let cb: IntersectionObserverCallback = () => {}
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(c: IntersectionObserverCallback) {
          cb = c
        }
        observe = vi.fn()
        disconnect = vi.fn()
      },
    )
    const { container } = render(<Amount value="500" currency="USD" animate />)
    step(100)
    step(900)
    expect(container.querySelector('[data-frame]')?.getAttribute('data-frame')).toBe('$0.00')
    act(() =>
      cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver),
    )
    step(2000)
    step(2400)
    step(3000)
    expect(container.querySelector('[data-frame]')?.getAttribute('data-frame')).toBe('$500.00')
  })
})

describe('motion override', () => {
  it('"on" beats the OS reduced-motion setting and persists; "system" restores it', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    expect(prefersReducedMotion()).toBe(true)
    writeMotionPref('on')
    expect(readMotionPref()).toBe('on')
    expect(document.documentElement.dataset.motion).toBe('on')
    expect(prefersReducedMotion()).toBe(false)
    writeMotionPref('system')
    expect(readMotionPref()).toBe('system')
    expect(document.documentElement.dataset.motion).toBeUndefined()
    expect(prefersReducedMotion()).toBe(true)
  })
})
