import { useReducedMotion } from 'motion/react'

/** Spring presets (plan Appendix B). */
export const springs = {
  sheet: { type: 'spring', stiffness: 380, damping: 32 },
  press: { type: 'spring', stiffness: 500, damping: 30 },
  list: { type: 'spring', stiffness: 420, damping: 36 },
} as const

export type SpringName = keyof typeof springs

const INSTANT = { duration: 0 } as const

/**
 * Returns the named spring, or an instant transition when the user prefers
 * reduced motion. Use for anything that moves under a finger.
 */
export function useSpring(name: SpringName) {
  const reduced = useReducedMotion()
  return reduced ? INSTANT : springs[name]
}
