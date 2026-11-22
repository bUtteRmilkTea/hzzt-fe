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
/**
 * How long a change takes: a small nudge is quick, a big swing takes longer (400 to 900 ms). The
 * first view always takes the full COUNT_UP_MS. `ratio` is |change| relative to the larger value.
 */
export function countDuration(from: string, to: string): number {
  const a = toDecimal(from)
  const b = toDecimal(to)
  const top = a.abs().gt(b.abs()) ? a.abs() : b.abs()
  if (top.isZero()) return COUNT_UP_MS
  const ratio = Math.min(1, b.minus(a).abs().div(top).toNumber())
  return Math.round(400 + 500 * ratio)
}

export function useCountUp(
  target: string,
  enabled: boolean,
  duration?: number,
  /** Hold the first frame until the number has been on screen (D-F20). */
  startWhen = true,
): string {
  const [shown, setShown] = useState(enabled && !prefersReducedMotion() ? '0' : target)
  const shownRef = useRef(shown)
  shownRef.current = shown

  useEffect(() => {
    if (!enabled || prefersReducedMotion()) {
      setShown(target)
      return
    }
    if (!startWhen) return
    const from = shownRef.current
    if (from === target) return
    const ms = duration ?? (from === '0' ? COUNT_UP_MS : countDuration(from, target))
    let raf = 0
    let start: number | undefined
    const frame = (now: number) => {
      start ??= now
      const t = Math.min(1, (now - start) / ms)
      setShown(interpolateMoney(from, target, easeOutCubic(t)))
      if (t < 1) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [target, enabled, duration, startWhen])

  return shown
}
