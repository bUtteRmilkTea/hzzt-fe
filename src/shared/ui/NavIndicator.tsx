import { useRouterState } from '@tanstack/react-router'
import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from './cn'

interface Box {
  x: number
  y: number
  w: number
  h: number
}

/**
 * One highlight element for the whole nav (D-F21). It measures whichever link is active and
 * slides to it with a CSS transition, so going from Home to Assets glides through History and
 * Wallets and never leaves a frame with nothing highlighted. The nav must be a positioned
 * element (fixed or relative), and its links `relative z-10` so they sit above the highlight.
 * The first paint is not animated. The global reduced-motion rule makes the slide instant.
 */
export function useNavIndicator(): {
  ref: RefObject<HTMLElement | null>
  box: Box | null
  animate: boolean
} {
  const ref = useRef<HTMLElement>(null)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [box, setBox] = useState<Box | null>(null)
  const [animate, setAnimate] = useState(false)

  const measure = useCallback(() => {
    const el = ref.current?.querySelector<HTMLElement>('a[data-status="active"]')
    if (!el) return setBox(null)
    const next = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }
    setBox((prev) =>
      prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h
        ? prev
        : next,
    )
  }, [])

  // Measure on every route change; the link's active state can land a frame later, so measure twice.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger, not a value used inside
  useLayoutEffect(() => {
    measure()
    const id = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(id)
  }, [pathname, measure])

  useEffect(() => {
    const nav = ref.current
    if (!nav) return
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    ro?.observe(nav)
    // Web fonts change item widths after first paint.
    void document.fonts?.ready.then(measure)
    // Turn the slide on only after the first position is in place.
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => {
      ro?.disconnect()
      cancelAnimationFrame(id)
    }
  }, [measure])

  return { ref, box, animate }
}

export function NavIndicator({
  box,
  animate,
  shape,
}: {
  box: Box | null
  animate: boolean
  shape: 'md' | 'full'
}) {
  return (
    <span
      aria-hidden
      data-testid="nav-indicator"
      className={cn(
        'pointer-events-none absolute top-0 left-0 z-0 bg-surface-3',
        shape === 'full' ? 'rounded-full' : 'rounded-md',
        animate &&
          'transition-[transform,width,height,opacity] duration-[var(--dur-slow,350ms)] ease-[cubic-bezier(0.22,0.61,0.36,1)]',
      )}
      style={{
        width: box?.w ?? 0,
        height: box?.h ?? 0,
        opacity: box ? 1 : 0,
        transform: `translate(${box?.x ?? 0}px, ${box?.y ?? 0}px)`,
      }}
    />
  )
}
