import { createFileRoute } from '@tanstack/react-router'
import { EditWalletScreen } from '@/features/wallets/EditWalletScreen'

export const Route = createFileRoute('/_authed/s/$spaceId/wallets/$id/edit')({
  component: EditWalletScreen,
})
