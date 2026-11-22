import { createFileRoute } from '@tanstack/react-router'
import { RequireFullTracking } from '@/app/RequireFullTracking'
import { SharingScreen } from '@/features/investments/SharingScreen'

export const Route = createFileRoute('/_authed/s/$spaceId/investments/$id/sharing')({
  component: () => (
    <RequireFullTracking>
      <SharingScreen />
    </RequireFullTracking>
  ),
})
