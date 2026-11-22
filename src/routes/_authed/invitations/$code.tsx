import { createFileRoute } from '@tanstack/react-router'
import { AcceptInvitationScreen } from '@/features/spaces/AcceptInvitationScreen'

export const Route = createFileRoute('/_authed/invitations/$code')({
  component: AcceptInvitationScreen,
})
