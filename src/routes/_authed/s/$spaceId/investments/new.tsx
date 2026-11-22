import { createFileRoute } from '@tanstack/react-router'
import { RequireFullTracking } from '@/app/RequireFullTracking'
import { CreateInvestmentScreen } from '@/features/investments/CreateInvestmentScreen'

export const Route = createFileRoute('/_authed/s/$spaceId/investments/new')({
  component: () => (
    <RequireFullTracking>
      <CreateInvestmentScreen />
    </RequireFullTracking>
  ),
})
