import { useEffect, useState } from 'react'

/**
 * The current time, refreshed on a timer (default each minute). It keeps "4 minutes ago" text
 * honest without a refetch. No timer runs while the tab is hidden, and it catches up on return.
 */
export function useNow(everyMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const tick = () => setNow(new Date())
    const id = setInterval(() => {
      if (document.visibilityState !== 'hidden') tick()
    }, everyMs)
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [everyMs])
  return now
}
