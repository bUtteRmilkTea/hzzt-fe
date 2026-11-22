import { useSyncExternalStore } from 'react'

/** True when the browser reports a connection. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (notify) => {
      window.addEventListener('online', notify)
      window.addEventListener('offline', notify)
      return () => {
        window.removeEventListener('online', notify)
        window.removeEventListener('offline', notify)
      }
    },
    () => navigator.onLine,
    () => true,
  )
}

/** Non-React callers (the API client) check this before a write. */
export const isOffline = (): boolean =>
  typeof navigator !== 'undefined' && navigator.onLine === false
