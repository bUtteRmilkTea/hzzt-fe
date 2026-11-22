import { createFileRoute } from '@tanstack/react-router'
import { HomeScreen } from '@/features/dashboard/HomeScreen'
import { validateHomeSearch } from '@/features/dashboard/search'

export const Route = createFileRoute('/_authed/s/$spaceId/')({
  validateSearch: validateHomeSearch,
  component: HomeScreen,
})
