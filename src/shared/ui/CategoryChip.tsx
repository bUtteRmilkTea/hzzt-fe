import { cn } from './cn'

interface CategoryChipProps {
  icon: string
  name: string
  color?: string
  selected?: boolean
  onClick?: () => void
  className?: string
}

/** A category as a chip: its colour dot, emoji and name. Static when there is no onClick. */
export function CategoryChip({
  icon,
  name,
  color,
  selected,
  onClick,
  className,
}: CategoryChipProps) {
  const body = (
    <>
      <span
        aria-hidden
        style={color ? { backgroundColor: color } : undefined}
        className={cn(
          'flex size-6 items-center justify-center rounded-full text-sm',
          !color && 'bg-surface-3',
        )}
      >
        {icon}
      </span>
      {name}
    </>
  )
  const base =
    'inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-medium'
  if (!onClick)
    return <span className={cn(base, 'border-border bg-surface-3', className)}>{body}</span>
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        base,
        'transition-colors duration-150',
        selected
          ? 'border-accent bg-accent/15 text-label'
          : 'border-border bg-surface-3 hover:border-border-strong',
        className,
      )}
    >
      {body}
    </button>
  )
}
