import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { format } from 'date-fns'
import { useState } from 'react'
import { useSpace } from '@/app/providers/SpaceProvider'
import { errorMessage } from '@/shared/api/errors'
import { toMoneyString } from '@/shared/money'
import { Amount } from '@/shared/ui/Amount'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Page } from '@/shared/ui/Page'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Skeleton } from '@/shared/ui/Skeleton'
import { useToast } from '@/shared/ui/Toast'
import { AssetForm } from './AssetForm'
import { useDeleteAsset, useManualAsset } from './hooks'
import { type AssetKind, kindMeta } from './kinds'
import { SettleSheet } from './SettleSheet'

export function AssetDetailScreen() {
  const { space } = useSpace()
  const { id } = useParams({ from: '/_authed/s/$spaceId/assets/$id/' })
  const navigate = useNavigate()
  const toast = useToast()
  const asset = useManualAsset(space.id, id)
  const remove = useDeleteAsset(space.id, id)
  const [settling, setSettling] = useState(false)
  const [confirm, setConfirm] = useState(false)

  if (asset.isPending)
    return (
      <Page width="wide">
        <Skeleton className="h-48" />
      </Page>
    )
  if (asset.isError || !asset.data) {
    return (
      <Page width="wide">
        <EmptyState
          title="Couldn't load this item"
          action={<Button onClick={() => void asset.refetch()}>Try again</Button>}
        />
      </Page>
    )
  }
  const a = asset.data
  const meta = kindMeta(a.kind)
  const currency = a.currency ?? ''

  return (
    <Page width="wide" gap={8}>
      <PageHeader title={a.name ?? meta.noun} />
      <div
        data-testid="asset-detail-layout"
        className="grid items-start gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-10"
      >
        <div className="flex min-w-0 flex-col gap-5">
          <Card className="flex flex-col gap-1" data-testid="asset-card">
            <p className="text-sm text-label-secondary">
              {a.kind === 'LIABILITY'
                ? 'Outstanding'
                : a.kind === 'RECEIVABLE'
                  ? 'Owed to you'
                  : 'Value'}
            </p>
            <p className="text-3xl font-medium" data-testid="asset-value">
              <Amount animate value={toMoneyString(a.currentValue)} currency={currency} />
            </p>
            {a.counterpartyName ? (
              <p className="text-sm text-label-secondary">
                {a.kind === 'LIABILITY' ? 'Owed to' : 'Owed by'} {a.counterpartyName}
              </p>
            ) : null}
            {a.dueDate ? (
              <p className="text-sm text-label-secondary">
                Due {format(new Date(`${a.dueDate}T12:00:00`), 'd MMM yyyy')}
              </p>
            ) : null}
            {a.note ? <p className="mt-2 text-sm">{a.note}</p> : null}
          </Card>

          <div className="flex flex-col gap-3">
            {meta.settles ? (
              <Button
                disabled={toMoneyString(a.currentValue) === '0'}
                onClick={() => setSettling(true)}
              >
                {meta.settleLabel}
              </Button>
            ) : null}
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" asChild>
                <Link to="/s/$spaceId/assets/$id/edit" params={{ spaceId: space.id, id }}>
                  Edit
                </Link>
              </Button>
              <Button
                variant="ghost"
                className="flex-1 text-negative"
                onClick={() => setConfirm(true)}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>

        {(a.history ?? []).length > 0 ? (
          <section aria-labelledby="hist" className="flex flex-col gap-2">
            <h2 id="hist" className="text-lg font-medium">
              History
            </h2>
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface-1">
              {(a.history ?? []).map((h) => (
                <li
                  key={`${h.changedAt}-${h.newValue}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <span>
                    <span className="block font-medium">
                      {h.reason === 'SETTLEMENT' ? 'Settlement' : 'Updated'}
                    </span>
                    <span className="text-label-secondary">
                      {h.changedAt ? format(new Date(h.changedAt), 'd MMM yyyy') : ''}
                    </span>
                  </span>
                  <span className="tabular">
                    <Amount value={toMoneyString(h.previousValue)} currency={currency} /> →{' '}
                    <Amount value={toMoneyString(h.newValue)} currency={currency} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="text-sm text-label-secondary">No changes yet.</p>
        )}
      </div>

      {settling ? <SettleSheet asset={a} onClose={() => setSettling(false)} /> : null}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${a.name}?`}
        description="It is removed from your net worth. Wallet balances are not changed."
        confirmLabel="Delete"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => {
              toast.show('Deleted', 'success')
              void navigate({ to: '/s/$spaceId/assets', params: { spaceId: space.id } })
            },
            onError: (e) => {
              setConfirm(false)
              toast.show(errorMessage(e), 'error')
            },
          })
        }
      />
    </Page>
  )
}

export function EditAssetScreen() {
  const { space } = useSpace()
  const { id } = useParams({ from: '/_authed/s/$spaceId/assets/$id/edit' })
  const asset = useManualAsset(space.id, id)
  return (
    <Page width="wide" gap={8}>
      <PageHeader title="Edit" />
      {asset.isPending ? (
        <Skeleton className="h-64" />
      ) : asset.isError || !asset.data ? (
        <EmptyState
          title="Couldn't load this item"
          action={<Button onClick={() => void asset.refetch()}>Try again</Button>}
        />
      ) : (
        <AssetForm
          key={asset.data.id}
          kind={(asset.data.kind ?? 'FIXED_ASSET') as AssetKind}
          asset={asset.data}
        />
      )}
    </Page>
  )
}

export function NewAssetScreen({ kind }: { kind: AssetKind }) {
  return (
    <Page width="wide" gap={8}>
      <PageHeader title={kindMeta(kind).addLabel} />
      <AssetForm kind={kind} />
    </Page>
  )
}
