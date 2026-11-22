import { createFileRoute } from '@tanstack/react-router'
import { EditTransactionSheet } from '@/features/transactions/EditTransactionSheet'

export const Route = createFileRoute('/_authed/s/$spaceId/transactions/$id')({
  component: EditTransactionSheet,
})
