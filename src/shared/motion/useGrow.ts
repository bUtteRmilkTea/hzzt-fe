import { useEffect, useState } from 'react'
import { prefersReducedMotion } from './timings'
import { useInView } from './useInView'

/**
 * A progress value that starts at 0 and grows to `target` the first time it is on screen, so the
 * CSS transition on the bar or ring has something to animate. Follows later changes to `target`
 * (the transition then runs from the old value). Instant under reduced motion and where
 * IntersectionObserver is missing.
 */
export function useGrow(target: number): [(el: Element | null) => void, number] {
  const instant = prefersReducedMotion() || typeof IntersectionObserver === 'undefined'
  const [ref, seen] = useInView(!instant)
  const [on, setOn] = useState(instant)
  useEffect(() => {
    if (!seen || on) return
    const id = requestAnimationFrame(() => setOn(true))
    return () => cancelAnimationFrame(id)
  }, [seen, on])
  return [ref, on ? target : 0]
}
