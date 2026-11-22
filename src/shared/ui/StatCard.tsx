import type { ReactNode } from 'react'
import { cn } from './cn'

interface StatCardProps {
  label: string
  /** The figure, usually an <Amount>. */
  value: ReactNode
  /** A small secondary line, e.g. a change badge. */
  note?: ReactNode
  className?: string
}

export function StatCard({ label, value, note, className }: StatCardProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-surface-1 p-4', className)}>
      <p className="text-sm text-label-secondary">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
      {note ? <p className="mt-1 text-sm text-label-secondary">{note}</p> : null}
    </div>
  )
}
