import { createFileRoute } from '@tanstack/react-router'
import { validateHistorySearch } from '@/features/transactions/filters'
import { HistoryScreen } from '@/features/transactions/HistoryScreen'

// Period, search text and the category / wallet filters live in the URL, so a link restores the view.
export const Route = createFileRoute('/_authed/s/$spaceId/history')({
  validateSearch: validateHistorySearch,
  component: HistoryScreen,
})
