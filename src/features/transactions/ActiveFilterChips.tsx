import { X } from 'lucide-react'
import { useCategories } from '@/shared/api/categories'
import { useWallets } from '@/shared/api/wallets'
import { categoryLabel } from '@/shared/i18n'
import { DEFAULT_PERIOD, periodsEqual } from '@/shared/period'
import { periodLabel } from '@/shared/period/format'
import { type TransactionFilters, toggle } from './filters'

function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove filter: ${label}`}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-surface-3 pr-2.5 pl-3.5 text-sm font-medium hover:border-border-strong"
    >
      {label}
      <X aria-hidden className="size-4 text-label-secondary" />
    </button>
  )
}

/**
 * A removable chip per active filter, under the search field. Removing one writes the URL
 * straight away. Nothing renders when no filter is active, so the row takes no space.
 */
export function ActiveFilterChips({
  spaceId,
  filters,
  onChange,
}: {
  spaceId: string
  filters: TransactionFilters
  onChange: (next: TransactionFilters) => void
}) {
  const expense = useCategories(spaceId, 'EXPENSE')
  const income = useCategories(spaceId, 'INCOME')
  const wallets = useWallets(spaceId)
  const categories = [...(expense.data ?? []), ...(income.data ?? [])]

  const periodActive = !periodsEqual(filters.period, DEFAULT_PERIOD)
  if (!periodActive && filters.categoryIds.length === 0 && filters.walletIds.length === 0)
    return null

  return (
    <ul aria-label="Active filters" className="flex flex-wrap gap-2">
      {periodActive ? (
        <li>
          <RemovableChip
            label={periodLabel(filters.period)}
            onRemove={() => onChange({ ...filters, period: DEFAULT_PERIOD })}
          />
        </li>
      ) : null}
      {filters.categoryIds.map((id) => {
        const c = categories.find((x) => x.id === id)
        return (
          <li key={`c-${id}`}>
            <RemovableChip
              label={`${c?.icon ?? '🏷️'} ${c ? categoryLabel(c) : 'Category'}`}
              onRemove={() =>
                onChange({ ...filters, categoryIds: toggle(filters.categoryIds, id) })
              }
            />
          </li>
        )
      })}
      {filters.walletIds.map((id) => {
        const w = (wallets.data?.items ?? []).find((x) => x.id === id)
        return (
          <li key={`w-${id}`}>
            <RemovableChip
              label={`${w?.icon ?? ''} ${w?.name ?? 'Wallet'}`.trim()}
              onRemove={() => onChange({ ...filters, walletIds: toggle(filters.walletIds, id) })}
            />
          </li>
        )
      })}
    </ul>
  )
}
