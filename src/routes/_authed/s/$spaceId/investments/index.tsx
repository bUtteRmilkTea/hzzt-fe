import { createFileRoute } from '@tanstack/react-router'
import { RequireFullTracking } from '@/app/RequireFullTracking'
import { InvestmentsScreen } from '@/features/investments/InvestmentsScreen'

export const Route = createFileRoute('/_authed/s/$spaceId/investments/')({
  component: () => (
    <RequireFullTracking>
      <InvestmentsScreen />
    </RequireFullTracking>
  ),
})
