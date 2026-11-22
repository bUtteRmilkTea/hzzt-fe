import { createFileRoute } from '@tanstack/react-router'
import { CardEditorScreen } from '@/features/wallets/CardEditorScreen'

export const Route = createFileRoute('/_authed/s/$spaceId/wallets/$id/card')({
  component: CardEditorScreen,
})
