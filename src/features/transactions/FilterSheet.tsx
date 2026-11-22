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
import { SheetShell } from '@/shared/ui/SheetShell'
import { EMPTY_FILTERS, filtersFromSearch, filtersToSearch, toggle } from './filters'

/** Route-driven filter sheet: edits a draft, and only Apply writes it to the URL. */
export function FilterSheet() {
  const { space } = useSpace()
  const search = useSearch({ from: '/_authed/s/$spaceId/history' })
  const navigate = useNavigate()
  const current = useMemo(() => filtersFromSearch(search), [search])
  const [draft, setDraft] = useState(current)
  const [from, setFrom] = useState(current.period.kind === 'range' ? current.period.from : '')
  const [to, setTo] = useState(current.period.kind === 'range' ? current.period.to : '')

  const expense = useCategories(space.id, 'EXPENSE')
  const income = useCategories(space.id, 'INCOME')
  const wallets = useWallets(space.id)

  const close = () =>
    navigate({
      to: '/s/$spaceId/history',
      params: { spaceId: space.id },
      search: filtersToSearch(current),
      replace: true,
    })
  const apply = () =>
    navigate({
      to: '/s/$spaceId/history',
      params: { spaceId: space.id },
      search: filtersToSearch(draft),
      replace: true,
    })
  const setPeriod = (period: Period) => setDraft((d) => ({ ...d, period }))
  const rangeOk = isValidDay(from) && isValidDay(to)

  return (
    <SheetShell
      open
      onOpenChange={(o) => !o && close()}
      title="Filters"
      footer={
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => {
              setDraft({ ...EMPTY_FILTERS, q: draft.q })
              setFrom('')
              setTo('')
            }}
          >
            Clear
          </Button>
          <Button className="flex-1" onClick={() => void apply()}>
            Apply
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium text-label-secondary">Date</legend>
          <div className="flex flex-wrap gap-2">
            {PERIOD_PRESETS.map((p) => (
              <Chip
                key={p.value}
                selected={draft.period.kind === 'preset' && draft.period.preset === p.value}
                onClick={() => setPeriod({ kind: 'preset', preset: p.value })}
              >
                {p.label}
              </Chip>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
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
                selected={draft.categoryIds.includes(c.id as string)}
                onClick={() =>
                  setDraft((d) => ({ ...d, categoryIds: toggle(d.categoryIds, c.id as string) }))
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
                selected={draft.walletIds.includes(w.id as string)}
                onClick={() =>
                  setDraft((d) => ({ ...d, walletIds: toggle(d.walletIds, w.id as string) }))
                }
              >
                {w.icon} {w.name}
              </Chip>
            ))}
          </div>
        </fieldset>
      </div>
    </SheetShell>
  )
}
