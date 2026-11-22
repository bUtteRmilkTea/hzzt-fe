import { createFileRoute } from '@tanstack/react-router'
import { SettingsScreen } from '@/features/preferences/SettingsScreen'

export const Route = createFileRoute('/_authed/settings/')({ component: SettingsScreen })
