import { createFileRoute } from '@tanstack/react-router'
import { WalletDetailScreen } from '@/features/wallets/WalletDetailScreen'
import { validatePeriodSearch } from '@/shared/period'

export const Route = createFileRoute('/_authed/s/$spaceId/wallets/$id/')({
  validateSearch: validatePeriodSearch,
  component: WalletDetailScreen,
})
