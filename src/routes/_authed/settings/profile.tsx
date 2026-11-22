import { createFileRoute } from '@tanstack/react-router'
import { ProfileScreen } from '@/features/auth/ProfileScreen'

export const Route = createFileRoute('/_authed/settings/profile')({ component: ProfileScreen })
