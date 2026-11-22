import { createFileRoute } from '@tanstack/react-router'
import { AssetsScreen } from '@/features/assets/AssetsScreen'

export const Route = createFileRoute('/_authed/s/$spaceId/assets/')({ component: AssetsScreen })
