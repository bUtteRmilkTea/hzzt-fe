import type { components } from '@/shared/api/schema'
import { PALETTE } from '@/shared/ui/palette'

type S = components['schemas']

export const cat = (
  over: Partial<S['categories.CategoryDTO']> & {
    id: string
    name: string
    type: 'EXPENSE' | 'INCOME'
  },
): S['categories.CategoryDTO'] => ({
  icon: '🏷️',
  color: PALETTE[0],
  sortOrder: 0,
  ...over,
})

/** The 7 expense and 4 income categories a new space is seeded with by the backend. */
export const seededExpense = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Health',
  'Entertainment',
  'Other',
].map((name, i) => cat({ id: `e-${i}`, name, type: 'EXPENSE', sortOrder: i }))
export const seededIncome = ['Salary', 'Freelance', 'Investment', 'Dividend'].map((name, i) =>
  cat({ id: `i-${i}`, name, type: 'INCOME', sortOrder: i }),
)

export const withStats = (
  c: S['categories.CategoryDTO'],
  stats: S['categories.StatsDTO'],
): S['categories.CategoryDTO'] => ({ ...c, stats })
