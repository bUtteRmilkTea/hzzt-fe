import { createFileRoute } from '@tanstack/react-router'
import { WalletsScreen } from '@/features/wallets/WalletsScreen'

export const Route = createFileRoute('/_authed/s/$spaceId/wallets/')({ component: WalletsScreen })
