import { createFileRoute } from '@tanstack/react-router'
import { RequireFullTracking } from '@/app/RequireFullTracking'
import { NewAssetScreen } from '@/features/assets/AssetDetailScreen'
import type { AssetKind } from '@/features/assets/kinds'

export const Route = createFileRoute('/_authed/s/$spaceId/assets/new')({
  validateSearch: (search: Record<string, unknown>): { kind: AssetKind } => ({
    kind: search.kind === 'RECEIVABLE' || search.kind === 'LIABILITY' ? search.kind : 'FIXED_ASSET',
  }),
  component: function New() {
    const { kind } = Route.useSearch()
    return (
      <RequireFullTracking>
        <NewAssetScreen kind={kind} />
      </RequireFullTracking>
    )
  },
})
