import { createFileRoute } from '@tanstack/react-router'
import { FilterSheet } from '@/features/transactions/FilterSheet'

export const Route = createFileRoute('/_authed/s/$spaceId/history/filters')({
  component: FilterSheet,
})
