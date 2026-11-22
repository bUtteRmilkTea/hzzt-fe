import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderScreen } from '@/app/PlaceholderScreen'

export const Route = createFileRoute('/_authed/assets')({
  component: () => <PlaceholderScreen title="Assets" phase="F8" />,
})
