import { createFileRoute } from '@tanstack/react-router'
import { AddTransactionSheet } from '@/features/transactions/AddTransactionSheet'
import { safeReturnTo } from '@/features/transactions/returnTo'

export const Route = createFileRoute('/_authed/s/$spaceId/transactions/new')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { type: 'EXPENSE' | 'INCOME' | 'TRANSFER'; from?: string; returnTo?: string } => ({
    type: search.type === 'INCOME' || search.type === 'TRANSFER' ? search.type : 'EXPENSE',
    ...(typeof search.from === 'string' && /^[\w-]{1,64}$/.test(search.from)
      ? { from: search.from }
      : {}),
    ...(safeReturnTo(search.returnTo) ? { returnTo: safeReturnTo(search.returnTo) } : {}),
  }),
  component: AddTransactionSheet,
})
