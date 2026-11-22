import { createFileRoute } from '@tanstack/react-router'
import { RequireFullTracking } from '@/app/RequireFullTracking'
import { EditAssetScreen } from '@/features/assets/AssetDetailScreen'

export const Route = createFileRoute('/_authed/s/$spaceId/assets/$id/edit')({
  component: () => (
    <RequireFullTracking>
      <EditAssetScreen />
    </RequireFullTracking>
  ),
})
