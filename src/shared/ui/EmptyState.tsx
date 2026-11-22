import type { ReactNode } from 'react'
import { cn } from './cn'

interface EmptyStateProps {
  title: string
  description?: string
  /** One action only. */
  action?: ReactNode
  className?: string
}

/** Illustration-free card with a single action. */
export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border border-border bg-surface-1 px-6 py-10 text-center',
        className,
      )}
    >
      <h2 className="text-lg font-medium">{title}</h2>
      {description ? <p className="max-w-xs text-sm text-label-secondary">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
