import { useCallback, useEffect, useState } from 'react'

/**
 * True once the element has been on screen (D-F20), and stays true. Charts and counters wait for
 * this, so a card below the fold animates when you scroll to it instead of finishing unseen.
 * Returns a callback ref (not an object ref) so it still works when the element is swapped, for
 * example a skeleton replaced by the chart. With `enabled` false, or where IntersectionObserver
 * is missing (jsdom), it is true straight away.
 */
export function useInView(enabled = true): [(el: Element | null) => void, boolean] {
  const [el, setEl] = useState<Element | null>(null)
  const [seen, setSeen] = useState(() => !enabled || typeof IntersectionObserver === 'undefined')
  const ref = useCallback((node: Element | null) => setEl(node), [])
  useEffect(() => {
    if (seen || !el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true)
          io.disconnect()
        }
      },
      { threshold: 0.25 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [seen, el])
  return [ref, seen]
}
