import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderScreen } from '@/app/PlaceholderScreen'

export const Route = createFileRoute('/_authed/s/$spaceId/wallets')({
  component: () => <PlaceholderScreen title="Wallets" phase="F4" />,
})
