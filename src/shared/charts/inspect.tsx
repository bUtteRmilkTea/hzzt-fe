import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

/**
 * Tap, hover and keyboard inspection shared by the charts (F33-T04). `xs` are the plot x
 * positions of the points; the active one is the nearest to the pointer. Touch drags that are
 * mostly vertical are left to the browser (the chart sets `touch-action: pan-y`).
 */
export function useInspect(xs: readonly number[]) {
  const [index, setIndex] = useState<number | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const count = xs.length

  const nearest = useCallback(
    (clientX: number) => {
      const el = boxRef.current
      if (!el || count === 0) return null
      const x = clientX - el.getBoundingClientRect().left
      let best = 0
      for (let i = 1; i < count; i++)
        if (Math.abs((xs[i] as number) - x) < Math.abs((xs[best] as number) - x)) best = i
      return best
    },
    [xs, count],
  )

  // A touch inspection stays until the user taps elsewhere.
  useEffect(() => {
    if (index === null) return
    const away = (e: Event) => {
      if (!boxRef.current?.contains(e.target as Node)) setIndex(null)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [index])

  const onPointerDown = (e: PointerEvent) => setIndex(nearest(e.clientX))
  const onPointerMove = (e: PointerEvent) => setIndex(nearest(e.clientX))
  const onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') setIndex(null)
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (count === 0) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const step = e.key === 'ArrowRight' ? 1 : -1
      setIndex((i) => Math.min(count - 1, Math.max(0, (i ?? (step > 0 ? -1 : count)) + step)))
    } else if (e.key === 'Escape') setIndex(null)
    else if (e.key === 'Home') setIndex(0)
    else if (e.key === 'End') setIndex(count - 1)
  }
  return {
    index: index !== null && index < count ? index : null,
    boxRef,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerLeave,
      onKeyDown,
      onBlur: () => setIndex(null),
    },
  }
}

/** A tooltip box positioned at `x` inside a relatively positioned chart, kept inside its width. */
export function ChartTooltip({
  x,
  width,
  children,
}: {
  x: number
  width: number
  children: ReactNode
}) {
  const half = 80
  const left = Math.min(Math.max(x, half), Math.max(half, width - half))
  return (
    <div
      data-testid="chart-tooltip"
      role="presentation"
      style={{ left }}
      className="pointer-events-none absolute top-0 z-10 w-max max-w-[11rem] -translate-x-1/2 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs shadow-card"
    >
      {children}
    </div>
  )
}
