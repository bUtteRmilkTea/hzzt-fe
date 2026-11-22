import { Link, type LinkProps } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Amount } from '@/shared/ui/Amount'

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

/**
 * The rows inside one section of the Assets page: optional sub-groups (a wallet type, an
 * investment category) each with a title and total, then name, balance and PnL per row.
 */
export function AssetBreakdownList({
  groups,
  empty,
}: {
  groups: readonly BreakdownGroup[]
  empty?: ReactNode
}) {
  const nonEmpty = groups.filter((g) => g.rows.length > 0)
  if (nonEmpty.length === 0) return empty ? (empty as React.ReactElement) : null
  return (
    <div className="flex flex-col gap-3">
      {nonEmpty.map((g) => (
        <div key={g.key} className="flex flex-col gap-1">
          {g.title ? (
            <div className="flex items-baseline justify-between px-2 text-sm font-semibold tracking-wide text-label-secondary uppercase">
              <h2>{g.title}</h2>
              {g.total ? <Amount value={g.total.value} currency={g.total.currency} /> : null}
            </div>
          ) : null}
          <ul className="flex flex-col">
            {g.rows.map((r) => (
              <li key={r.key}>
                <Row row={r} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
