import { createFileRoute } from '@tanstack/react-router'
import { GoalsScreen } from '@/features/goals/GoalsScreen'

export const Route = createFileRoute('/_authed/s/$spaceId/goals/')({ component: GoalsScreen })
