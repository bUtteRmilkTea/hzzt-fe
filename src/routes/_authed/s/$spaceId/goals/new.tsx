import { createFileRoute } from '@tanstack/react-router'
import { GoalFormScreen } from '@/features/goals/GoalFormScreen'

export const Route = createFileRoute('/_authed/s/$spaceId/goals/new')({ component: GoalFormScreen })
