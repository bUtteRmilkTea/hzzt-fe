import { createFileRoute } from '@tanstack/react-router'
import { RequireFullTracking } from '@/app/RequireFullTracking'
import { InvitationsScreen } from '@/features/investments/InvitationsScreen'

export const Route = createFileRoute('/_authed/invitations/shared')({
  component: () => (
    <RequireFullTracking>
      <InvitationsScreen />
    </RequireFullTracking>
  ),
})
