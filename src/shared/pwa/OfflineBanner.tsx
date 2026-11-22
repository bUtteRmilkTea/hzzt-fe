import { WifiOff } from 'lucide-react'
import { useOnline } from './online'

/**
 * Shown while the browser is offline. Screens keep showing what is already in the query cache;
 * saving is refused with a clear message instead of being queued (offline writes are out of scope).
 */
export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div
      role="status"
      className="pt-safe sticky top-0 z-50 flex items-center justify-center gap-2 border-b border-warning bg-surface-2 px-4 py-2 text-center text-sm font-medium text-label"
    >
      <WifiOff aria-hidden className="size-4 shrink-0 text-warning" />
      You're offline. You can read what's already loaded, but changes need a connection.
    </div>
  )
}
