/** Motion spec (plan addendum D-F15). Plain constants, so importing them never pulls in the animation library. */
export const COUNT_UP_MS = 700
export const LINE_DRAW_MS = 900
export const BAR_GROW_MS = 500
export const BAR_STAGGER_MS = 40
export const DONUT_SWEEP_MS = 700

/** True when motion should be skipped: the OS asks for it and the user has not chosen "Always play". */
export function prefersReducedMotion(): boolean {
  if (typeof document !== 'undefined' && document.documentElement.dataset.motion === 'on')
    return false
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
