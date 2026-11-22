import { createFileRoute } from '@tanstack/react-router'
import { CategoriesScreen } from '@/features/categories/CategoriesScreen'

export const Route = createFileRoute('/_authed/s/$spaceId/categories')({
  // The open tab is view state, so it lives in the URL.
  validateSearch: (search: Record<string, unknown>): { tab: 'EXPENSE' | 'INCOME' } => ({
    tab: search.tab === 'INCOME' ? 'INCOME' : 'EXPENSE',
  }),
  component: CategoriesScreen,
})
