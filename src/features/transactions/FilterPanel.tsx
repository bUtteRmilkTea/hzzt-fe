import { useNavigate, useSearch } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useSpace } from '@/app/providers/SpaceProvider'
import { useCategories } from '@/shared/api/categories'
import { useWallets } from '@/shared/api/wallets'
import { isValidDay, PERIOD_PRESETS, type Period } from '@/shared/period'
import { Button } from '@/shared/ui/Button'
import { CategoryChip } from '@/shared/ui/CategoryChip'
import { Chip } from '@/shared/ui/Chip'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { EMPTY_FILTERS, filtersFromSearch, filtersToSearch, toggle } from './filters'

/**
 * Desktop (1024px+) inline version of FilterSheet. Same URL state (`filters.ts`), but every
 * change is written straight to the URL: no draft, no Apply.
 */
export function FilterPanel() {
  const { space } = useSpace()
  const search = useSearch({ from: '/_authed/s/$spaceId/history' })
  const navigate = useNavigate()
  const current = useMemo(() => filtersFromSearch(search), [search])
  const [from, setFrom] = useState(current.period.kind === 'range' ? current.period.from : '')
  const [to, setTo] = useState(current.period.kind === 'range' ? current.period.to : '')

  const expense = useCategories(space.id, 'EXPENSE')
  const income = useCategories(space.id, 'INCOME')
  const wallets = useWallets(space.id)

  const write = (next: typeof current) =>
    navigate({
      to: '/s/$spaceId/history',
      params: { spaceId: space.id },
      search: filtersToSearch(next),
      replace: true,
    })
  const setPeriod = (period: Period) => write({ ...current, period })
  const rangeOk = isValidDay(from) && isValidDay(to)

  return (
    <aside
      aria-label="Filters"
      data-testid="filter-panel"
      className="sticky top-4 flex max-h-[calc(100dvh-6rem)] w-64 shrink-0 flex-col gap-6 self-start overflow-y-auto rounded-lg border border-border bg-surface-1 p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Filters</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setFrom('')
            setTo('')
            void write({ ...EMPTY_FILTERS, q: current.q })
          }}
        >
          Clear
        </Button>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-label-secondary">Period</legend>
        <div className="flex flex-wrap gap-2">
          {PERIOD_PRESETS.map((p) => (
            <Chip
              key={p.value}
              selected={current.period.kind === 'preset' && current.period.preset === p.value}
              onClick={() => setPeriod({ kind: 'preset', preset: p.value })}
            >
              {p.label}
            </Chip>
          ))}
        </div>
        <Field label="From">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Button
          variant="secondary"
          size="sm"
          disabled={!rangeOk}
          onClick={() =>
            setPeriod(
              from <= to ? { kind: 'range', from, to } : { kind: 'range', from: to, to: from },
            )
          }
        >
          Use custom range
        </Button>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-label-secondary">Categories</legend>
        <div className="flex flex-wrap gap-2">
          {[...(expense.data ?? []), ...(income.data ?? [])].map((c) => (
            <CategoryChip
              key={c.id}
              icon={c.icon ?? '🏷️'}
              name={c.name ?? ''}
              color={c.color}
              selected={current.categoryIds.includes(c.id as string)}
              onClick={() =>
                write({ ...current, categoryIds: toggle(current.categoryIds, c.id as string) })
              }
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-label-secondary">Wallets</legend>
        <div className="flex flex-wrap gap-2">
          {(wallets.data?.items ?? []).map((w) => (
            <Chip
              key={w.id}
              selected={current.walletIds.includes(w.id as string)}
              onClick={() =>
                write({ ...current, walletIds: toggle(current.walletIds, w.id as string) })
              }
            >
              {w.icon} {w.name}
            </Chip>
          ))}
        </div>
      </fieldset>
    </aside>
  )
}
