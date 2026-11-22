import { useEffect, useRef, useState } from 'react'
import { Decimal, toDecimal } from '@/shared/money'
import { COUNT_UP_MS, prefersReducedMotion } from '@/shared/motion/timings'

/**
 * Money at progress `t` (0..1) between two API money strings. Uses Decimal, never Number(),
 * and returns `to` verbatim at t >= 1 so the last frame is exactly what the server sent.
 */
export function interpolateMoney(from: string, to: string, t: number): string {
  if (t >= 1) return to
  if (t <= 0) return from
  const a = toDecimal(from)
  const b = toDecimal(to)
  // t is a unitless progress fraction, not money, so a float is fine here.
  return a.plus(b.minus(a).times(new Decimal(Math.round(t * 1e6)).div(1e6))).toString()
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

/**
 * The money string to display. Counts from the previous value (0 on first view) to `target`
 * over `duration` ms, then returns `target` exactly. When `enabled` is false, or the user
 * prefers reduced motion, it is just `target`.
 */
export function useCountUp(target: string, enabled: boolean, duration = COUNT_UP_MS): string {
  const [shown, setShown] = useState(enabled && !prefersReducedMotion() ? '0' : target)
  const shownRef = useRef(shown)
  shownRef.current = shown

  useEffect(() => {
    if (!enabled || prefersReducedMotion()) {
      setShown(target)
      return
    }
    const from = shownRef.current
    if (from === target) return
    let raf = 0
    let start: number | undefined
    const frame = (now: number) => {
      start ??= now
      const t = Math.min(1, (now - start) / duration)
      setShown(interpolateMoney(from, target, easeOutCubic(t)))
      if (t < 1) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [target, enabled, duration])

  return shown
}
