import { createFileRoute } from '@tanstack/react-router'
import { RequireFullTracking } from '@/app/RequireFullTracking'
import { InvestmentDetailScreen } from '@/features/investments/InvestmentDetailScreen'

export const Route = createFileRoute('/_authed/s/$spaceId/investments/$id/')({
  component: () => (
    <RequireFullTracking>
      <InvestmentDetailScreen />
    </RequireFullTracking>
  ),
})
