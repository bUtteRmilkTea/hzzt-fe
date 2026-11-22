import { createFileRoute } from '@tanstack/react-router'
import { SpaceSettingsScreen } from '@/features/spaces/SpaceSettingsScreen'

export const Route = createFileRoute('/_authed/settings/space')({ component: SpaceSettingsScreen })
