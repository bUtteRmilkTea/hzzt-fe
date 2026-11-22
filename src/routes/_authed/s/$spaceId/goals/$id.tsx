import { createFileRoute } from '@tanstack/react-router'
import { GoalDetailScreen } from '@/features/goals/GoalDetailScreen'

export const Route = createFileRoute('/_authed/s/$spaceId/goals/$id')({
  component: GoalDetailScreen,
})
