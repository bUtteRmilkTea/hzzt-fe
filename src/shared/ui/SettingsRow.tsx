import { Link, type LinkProps } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

const rowClass =
  'flex min-h-14 w-full items-center justify-between gap-4 px-4 py-2 text-left text-base'

/** A row in a grouped settings list: a link, or a static row with a trailing control. */
export function SettingsRow({
  label,
  value,
  to,
  params,
  children,
}: {
  label: string
  value?: string
  to?: LinkProps['to']
  params?: LinkProps['params']
  children?: ReactNode
}) {
  if (to) {
    return (
      <Link to={to} {...(params ? { params } : {})} className={`${rowClass} hover:bg-surface-3`}>
        <span>{label}</span>
        <span className="flex items-center gap-2 text-label-secondary">
          {value}
          <ChevronRight aria-hidden className="size-4" />
        </span>
      </Link>
    )
  }
  return (
    <div className={rowClass}>
      <span>{label}</span>
      {children ?? <span className="text-label-secondary">{value}</span>}
    </div>
  )
}

export function SettingsGroup({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-1">
      {children}
    </div>
  )
}
