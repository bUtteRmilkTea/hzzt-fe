import { createFileRoute } from '@tanstack/react-router'
import { CurrencyScreen } from '@/features/spaces/CurrencyScreen'

export const Route = createFileRoute('/_authed/settings/currency')({ component: CurrencyScreen })
