import { Navigate } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useSpace } from '@/app/providers/SpaceProvider'

/**
 * In CASH_ONLY tracking mode everything but cash is hidden everywhere, not just on the asset page.
 * Screens for investments and manual assets sit behind this and send the user back to the asset page.
 */
export function RequireFullTracking({ children }: { children: ReactNode }) {
  const { space } = useSpace()
  if (space.trackingMode === 'CASH_ONLY')
    return <Navigate to="/s/$spaceId/assets" params={{ spaceId: space.id }} replace />
  return <>{children}</>
}
