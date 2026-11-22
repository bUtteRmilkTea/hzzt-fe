/** Motion spec (plan addendum D-F15). Plain constants, so importing them never pulls in the animation library. */
export const COUNT_UP_MS = 700
export const LINE_DRAW_MS = 900
export const BAR_GROW_MS = 500
export const BAR_STAGGER_MS = 40
export const DONUT_SWEEP_MS = 700

/** True when the user asked the OS for less motion. Safe where matchMedia is missing (SSR, jsdom). */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
