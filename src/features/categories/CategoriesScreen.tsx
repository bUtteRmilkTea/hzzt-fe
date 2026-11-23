import { useMutation } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { useSpace } from '@/app/providers/SpaceProvider'
import type { CategoryDTO, CategoryType } from '@/shared/api/categories'
import { api } from '@/shared/api/client'
import { errorMessage } from '@/shared/api/errors'
import { DonutChart } from '@/shared/charts'
import { categoryLabel } from '@/shared/i18n'
import { toMoneyString } from '@/shared/money'
import { DEFAULT_PERIOD } from '@/shared/period'
import { Amount } from '@/shared/ui/Amount'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Page } from '@/shared/ui/Page'
import { PageGrid, Panel } from '@/shared/ui/PageGrid'
import { PageHeader } from '@/shared/ui/PageHeader'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { Skeleton } from '@/shared/ui/Skeleton'
import { STAGGER, staggerStyle } from '@/shared/ui/stagger'
import { useToast } from '@/shared/ui/Toast'
import { WarningsStrip } from '@/shared/ui/WarningsStrip'
import { useBreakdown } from '../dashboard/hooks'
import { moveItem } from '../wallets/hooks'
import { BudgetProgress } from './BudgetProgress'
import { CategoryFormSheet } from './CategoryFormSheet'
import { useCategories, useInvalidateCategories, useReorderCategories } from './hooks'

type Sheet = { kind: 'new' } | { kind: 'edit'; category: CategoryDTO } | null

/** Where this period's money went, from the server's category breakdown. Sits beside the list from lg. */
function CategoryRail({ type }: { type: CategoryType }) {
  const { space } = useSpace()
  const q = useBreakdown(space.id, DEFAULT_PERIOD, type)
  if (q.isPending) return <Skeleton className="h-72" />
  if (!q.isSuccess || q.data.items.length === 0) return null
  return (
    <Panel
      span={4}
      aria-label="Category split"
      data-testid="category-rail"
      className="lg:sticky lg:top-4 lg:self-start"
    >
      <h2 className="mb-3 text-base font-semibold">
        {type === 'EXPENSE' ? 'Where it went' : 'Where it came from'}
      </h2>
      <DonutChart
        draw
        size={176}
        label={`${type === 'EXPENSE' ? 'Expenses' : 'Income'} by category`}
        currency={q.data.currency || space.baseCurrency}
        centre={{
          value: String(q.data.items.reduce((n, i) => n + i.count, 0)),
          caption: 'transactions',
        }}
        slices={q.data.items.map((i) => ({
          key: i.key,
          amount: i.amount,
          name: i.name,
          icon: i.icon,
          color: i.color ?? 'var(--label-tertiary)',
          pct: i.pct,
          count: i.count,
          interactive: false,
        }))}
      />
    </Panel>
  )
}

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
          {
            value: 'EXPENSE',
            label: 'Expense',
            icon: <TrendingDown aria-hidden className="size-4" />,
          },
          { value: 'INCOME', label: 'Income', icon: <TrendingUp aria-hidden className="size-4" /> },
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
          <PageGrid>
            <div className="min-w-0 lg:col-span-8">
              <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
                {categories.data.map((c, i, all) => (
                  <li key={c.id} className={STAGGER} style={staggerStyle(i)}>
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
            </div>
            <CategoryRail type={type} />
          </PageGrid>
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
          <p className="truncate font-medium">{categoryLabel(c)}</p>
          {!hasBudget && stats ? (
            <p className="text-sm text-label-secondary">
              {type === 'EXPENSE' ? 'Spent' : 'Received'}{' '}
              <Amount
                animate
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
