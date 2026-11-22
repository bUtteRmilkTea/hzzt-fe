import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderScreen } from '@/app/PlaceholderScreen'

export const Route = createFileRoute('/_authed/s/$spaceId/history')({
  component: () => <PlaceholderScreen title="History" phase="F5" />,
})
