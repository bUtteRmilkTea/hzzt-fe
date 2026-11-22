import { createFileRoute } from '@tanstack/react-router'
import { SecurityScreen } from '@/features/preferences/SecurityScreen'

export const Route = createFileRoute('/_authed/settings/security')({ component: SecurityScreen })
