import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useSpace } from '@/app/providers/SpaceProvider'

export const Route = createFileRoute('/_authed/')({ component: ToActiveSpace })

/** `/` sends you to your active space. */
function ToActiveSpace() {
  const { space } = useSpace()
  return <Navigate to="/s/$spaceId" params={{ spaceId: space.id }} replace />
}
