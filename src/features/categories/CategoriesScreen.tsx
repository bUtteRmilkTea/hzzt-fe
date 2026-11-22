import { useMutation } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useSpace } from '@/app/providers/SpaceProvider'
import type { CategoryDTO, CategoryType } from '@/shared/api/categories'
import { api } from '@/shared/api/client'
import { errorMessage } from '@/shared/api/errors'
import { toMoneyString } from '@/shared/money'
import { Amount } from '@/shared/ui/Amount'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Page } from '@/shared/ui/Page'
import { PageHeader } from '@/shared/ui/PageHeader'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { Skeleton } from '@/shared/ui/Skeleton'
import { useToast } from '@/shared/ui/Toast'
import { WarningsStrip } from '@/shared/ui/WarningsStrip'
import { moveItem } from '../wallets/hooks'
import { BudgetProgress } from './BudgetProgress'
import { CategoryFormSheet } from './CategoryFormSheet'
import { useCategories, useInvalidateCategories, useReorderCategories } from './hooks'

type Sheet = { kind: 'new' } | { kind: 'edit'; category: CategoryDTO } | null

export function CategoriesScreen() {
  const { space } = useSpace()
  const { tab } = useSearch({ from: '/_authed/s/$spaceId/categories' })
  const navigate = useNavigate()
  const toast = useToast()
  const invalidate = useInvalidateCategories(space.id)
  const type: CategoryType = tab
  // Stats are requested here, and only here, because this screen shows them.
  const categories = useCategories(space.id, type, { stats: true })
  const reorder = useReorderCategories(space.id, type)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [reordering, setReordering] = useState(false)
  const [toDelete, setToDelete] = useState<CategoryDTO | null>(null)

  const remove = useMutation({
    mutationFn: async (id: string) =>
      api.DELETE('/spaces/{spaceId}/categories/{id}', {
        params: { path: { spaceId: space.id, id } },
      }),
    meta: { silent: true },
    onSuccess: async () => {
      setToDelete(null)
      await invalidate()
      toast.show('Category deleted', 'success')
    },
    onError: (err) => {
      setToDelete(null)
      toast.show(errorMessage(err), 'error')
    },
  })

  const move = (index: number, to: number) => {
    const ids = moveItem(categories.data ?? [], index, to).map((c) => c.id as string)
    reorder.mutate(ids, { onError: (err) => toast.show(errorMessage(err), 'error') })
  }

  const warnings = (categories.data ?? []).flatMap((c) => c.stats?.warnings ?? [])

  return (
    <Page>
      <PageHeader
        title="Categories"
        backToSettings
        action={
          <Button size="sm" onClick={() => setSheet({ kind: 'new' })}>
            <Plus aria-hidden className="size-4" />
            Add
          </Button>
        }
      />

      <SegmentedControl
        aria-label="Category type"
        value={type}
        onValueChange={(t) =>
          navigate({
            to: '/s/$spaceId/categories',
            params: { spaceId: space.id },
            search: { tab: t },
            replace: true,
          })
        }
        options={[
          { value: 'EXPENSE', label: 'Expense' },
          { value: 'INCOME', label: 'Income' },
        ]}
      />

      {categories.isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : categories.isError ? (
        <EmptyState
          title="Couldn't load categories"
          action={<Button onClick={() => void categories.refetch()}>Try again</Button>}
        />
      ) : categories.data.length === 0 ? (
        <EmptyState
          title={`No ${type === 'EXPENSE' ? 'expense' : 'income'} categories`}
          description="Add one to start organising your transactions."
          action={<Button onClick={() => setSheet({ kind: 'new' })}>Add category</Button>}
        />
      ) : (
        <>
          <WarningsStrip warnings={warnings} />
          {categories.data.length > 1 ? (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setReordering((r) => !r)}>
                {reordering ? 'Done' : 'Reorder'}
              </Button>
            </div>
          ) : null}
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {categories.data.map((c, i, all) => (
              <li key={c.id}>
                <CategoryRow
                  category={c}
                  type={type}
                  fallbackCurrency={space.baseCurrency}
                  reordering={reordering}
                  canMoveUp={i > 0}
                  canMoveDown={i < all.length - 1}
                  onMoveUp={() => move(i, i - 1)}
                  onMoveDown={() => move(i, i + 1)}
                  onEdit={() => setSheet({ kind: 'edit', category: c })}
                  onDelete={() => setToDelete(c)}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {sheet ? (
        <CategoryFormSheet
          type={type}
          {...(sheet.kind === 'edit' ? { category: sheet.category } : {})}
          onClose={() => setSheet(null)}
        />
      ) : null}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.name ?? 'category'}?`}
        description="Your past transactions keep this category. You just won't be able to pick it for new ones."
        confirmLabel="Delete category"
        destructive
        pending={remove.isPending}
        onConfirm={() => toDelete?.id && remove.mutate(toDelete.id)}
      />
    </Page>
  )
}

interface RowProps {
  category: CategoryDTO
  type: CategoryType
  fallbackCurrency: string
  reordering: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onEdit: () => void
  onDelete: () => void
}

function CategoryRow({
  category: c,
  type,
  fallbackCurrency,
  reordering,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
}: RowProps) {
  const stats = c.stats
  const currency = stats?.currency || c.budgetCurrency || fallbackCurrency
  const hasBudget = type === 'EXPENSE' && Boolean(c.budgetAmount)

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          style={c.color ? { backgroundColor: c.color } : undefined}
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-lg"
        >
          {c.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{c.name}</p>
          {!hasBudget && stats ? (
            <p className="text-sm text-label-secondary">
              {type === 'EXPENSE' ? 'Spent' : 'Received'}{' '}
              <Amount
                value={toMoneyString(type === 'EXPENSE' ? stats.spent : stats.received)}
                currency={currency}
              />
            </p>
          ) : null}
        </div>
        {reordering ? (
          <div className="flex gap-1">
            <Button
              variant="secondary"
              size="icon"
              aria-label={`Move ${c.name} up`}
              disabled={!canMoveUp}
              onClick={onMoveUp}
            >
              <ArrowUp aria-hidden className="size-5" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              aria-label={`Move ${c.name} down`}
              disabled={!canMoveDown}
              onClick={onMoveDown}
            >
              <ArrowDown aria-hidden className="size-5" />
            </Button>
          </div>
        ) : (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" aria-label={`Edit ${c.name}`} onClick={onEdit}>
              <Pencil aria-hidden className="size-5" />
            </Button>
            <Button variant="ghost" size="icon" aria-label={`Delete ${c.name}`} onClick={onDelete}>
              <Trash2 aria-hidden className="size-5" />
            </Button>
          </div>
        )}
      </div>
      {hasBudget && stats?.budgetUsedPct !== undefined ? (
        <BudgetProgress
          usedPct={stats.budgetUsedPct}
          spent={toMoneyString(stats.spent)}
          budget={toMoneyString(c.budgetAmount)}
          remaining={stats.budgetRemaining}
          currency={currency}
        />
      ) : hasBudget ? (
        <p className="text-sm text-label-secondary">
          Budget <Amount value={toMoneyString(c.budgetAmount)} currency={currency} />
        </p>
      ) : null}
    </Card>
  )
}
