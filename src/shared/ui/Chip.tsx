import type { ButtonHTMLAttributes } from 'react'
import { cn } from './cn'

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
}

export function Chip({ selected, className, type, ...props }: ChipProps) {
  return (
    <button
      type={type ?? 'button'}
      aria-pressed={selected}
      className={cn(
        'inline-flex min-h-12 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors duration-150',
        selected
          ? 'border-accent bg-accent text-accent-label'
          : 'border-border bg-surface-3 text-label hover:border-border-strong',
        className,
      )}
      {...props}
    />
  )
}
