import { type CategoryType, useCategories } from '@/shared/api/categories'
import { Button } from './Button'
import { CategoryChip } from './CategoryChip'
import { Skeleton } from './Skeleton'

interface CategoryPickerProps {
  spaceId: string
  /** Only categories of this transaction type are offered, so a type mismatch cannot be picked. */
  type: CategoryType
  value: string | null
  onChange: (id: string | null) => void
  label?: string
}

/** Pick one category of a given type. Used by the add-transaction sheet and the dashboard breakdown. */
export function CategoryPicker({
  spaceId,
  type,
  value,
  onChange,
  label = 'Category',
}: CategoryPickerProps) {
  const categories = useCategories(spaceId, type)

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-label-secondary">{label}</legend>
      {categories.isPending ? (
        <div className="flex gap-2" aria-busy="true">
          <Skeleton className="h-11 w-24 rounded-full" />
          <Skeleton className="h-11 w-24 rounded-full" />
          <Skeleton className="h-11 w-24 rounded-full" />
        </div>
      ) : categories.isError ? (
        <div className="flex items-center gap-3 text-sm text-label-secondary">
          Couldn't load categories.
          <Button size="sm" variant="secondary" onClick={() => void categories.refetch()}>
            Try again
          </Button>
        </div>
      ) : categories.data.length === 0 ? (
        <p className="text-sm text-label-secondary">No {type.toLowerCase()} categories yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {categories.data.map((c) => (
            <CategoryChip
              key={c.id}
              icon={c.icon ?? '🏷️'}
              name={c.name ?? ''}
              color={c.color}
              selected={value === c.id}
              onClick={() => onChange(value === c.id ? null : (c.id ?? null))}
            />
          ))}
        </div>
      )}
    </fieldset>
  )
}
