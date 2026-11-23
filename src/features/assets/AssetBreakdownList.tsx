import { Link, type LinkProps } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Amount } from '@/shared/ui/Amount'
import { Collapsible } from '@/shared/ui/Collapsible'
import { cn } from '@/shared/ui/cn'
import { STAGGER, staggerStyle } from '@/shared/ui/stagger'

export interface BreakdownRow {
  key: string
  icon?: string | undefined
  name: string
  /** Second line under the name (type, counterparty, symbol). */
  sub?: string | undefined
  value: string
  currency: string
  /** Unrealised profit or loss, shown with its sign and colour. */
  pl?: { amount: string; pct: string | null } | undefined
  link?: Pick<LinkProps, 'to' | 'params'> | undefined
}

export interface BreakdownGroup {
  key: string
  title?: string | undefined
  /** A line under the title, such as "3 holdings · 42.50%". */
  subtitle?: string | undefined
  /** Rows left out by the per-group cap. */
  more?: number | undefined
  /** Total of the group, shown beside its title. */
  total?: { value: string; currency: string } | undefined
  rows: BreakdownRow[]
}

function Row({ row }: { row: BreakdownRow }) {
  const body = (
    <>
      <span aria-hidden className="text-xl">
        {row.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{row.name}</span>
        {row.sub ? (
          <span className="block truncate text-sm text-label-secondary">{row.sub}</span>
        ) : null}
      </span>
      <span className="flex flex-col items-end">
        <Amount value={row.value} currency={row.currency} className="font-medium" />
        {row.pl ? (
          <span className="tabular text-sm" data-testid="row-pl">
            <Amount
              value={row.pl.amount}
              currency={row.currency}
              tone="auto"
              signDisplay="always"
            />
            {row.pl.pct !== null ? <> ({row.pl.pct}%)</> : null}
          </span>
        ) : null}
      </span>
    </>
  )
  const cls = 'flex min-h-14 items-center gap-3 rounded-md px-2'
  return row.link ? (
    <Link {...(row.link as LinkProps)} className={`${cls} hover:bg-surface-3`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function GroupBlock({
  group: g,
  collapsible,
  defaultOpen,
}: {
  group: BreakdownGroup
  collapsible: boolean
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  // Every titled group toggles, even with one row (D-F48). An untitled group never does.
  const toggles = collapsible && g.title !== undefined
  const bodyId = `group-${g.key}`.replace(/\W+/g, '-')
  const titleClass =
    'flex items-baseline justify-between px-2 text-sm font-semibold tracking-wide text-label-secondary uppercase'
  const rows = (
    <ul className="flex flex-col">
      {g.rows.map((r, i) => (
        <li key={r.key} className={STAGGER} style={staggerStyle(i)}>
          <Row row={r} />
        </li>
      ))}
    </ul>
  )
  return (
    <div className="flex flex-col gap-1">
      {g.title ? (
        toggles ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((o) => !o)}
            className={cn(titleClass, 'min-h-10 items-center text-left')}
          >
            <span className="flex items-center gap-1">
              <ChevronDown
                aria-hidden
                className={cn('size-4 shrink-0 transition-transform', !open && '-rotate-90')}
              />
              <h2>{g.title}</h2>
            </span>
            {g.total ? <Amount value={g.total.value} currency={g.total.currency} /> : null}
          </button>
        ) : (
          <div className={titleClass}>
            <h2>{g.title}</h2>
            {g.total ? <Amount value={g.total.value} currency={g.total.currency} /> : null}
          </div>
        )
      ) : null}
      {g.subtitle ? <p className="px-2 text-xs text-label-tertiary">{g.subtitle}</p> : null}
      {toggles ? (
        <Collapsible open={open} id={bodyId}>
          {rows}
        </Collapsible>
      ) : (
        rows
      )}
      {g.more && (!toggles || open) ? (
        <p className="px-2 text-sm text-label-secondary" data-testid="group-more">
          +{g.more} more
        </p>
      ) : null}
    </div>
  )
}

/**
 * The rows inside one section of the Assets page: optional sub-groups (a wallet type, a broker)
 * each with a title and total, then name, balance and PnL per row. With `collapsible`, a group
 * with a title is a dropdown, even with one row: the first group starts open, the rest closed.
 */
export function AssetBreakdownList({
  groups,
  empty,
  collapsible = false,
}: {
  groups: readonly BreakdownGroup[]
  empty?: ReactNode
  collapsible?: boolean
}) {
  const nonEmpty = groups.filter((g) => g.rows.length > 0)
  if (nonEmpty.length === 0) return empty ? (empty as React.ReactElement) : null
  return (
    <div className="flex flex-col gap-3">
      {nonEmpty.map((g, i) => (
        <GroupBlock key={g.key} group={g} collapsible={collapsible} defaultOpen={i === 0} />
      ))}
    </div>
  )
}
