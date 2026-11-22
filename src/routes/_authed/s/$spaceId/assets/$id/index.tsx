import { createFileRoute } from '@tanstack/react-router'
import { RequireFullTracking } from '@/app/RequireFullTracking'
import { AssetDetailScreen } from '@/features/assets/AssetDetailScreen'

export const Route = createFileRoute('/_authed/s/$spaceId/assets/$id/')({
  component: () => (
    <RequireFullTracking>
      <AssetDetailScreen />
    </RequireFullTracking>
  ),
})
