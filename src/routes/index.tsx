import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderScreen } from '@/app/PlaceholderScreen'

export const Route = createFileRoute('/')({
  component: () => <PlaceholderScreen title="Home" phase="F9" />,
})
