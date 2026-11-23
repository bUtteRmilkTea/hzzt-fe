import * as ToggleGroup from '@radix-ui/react-toggle-group'
import type { ReactNode } from 'react'
import { cn } from './cn'

interface Option<T extends string> {
  value: T
  label: string
  disabled?: boolean
  /** A vector icon before the label (decoration; the label names the option). */
  icon?: ReactNode
}

interface SegmentedControlProps<T extends string> {
  value: T
  onValueChange: (value: T) => void
  options: readonly Option<T>[]
  'aria-label': string
  className?: string
}

export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  className,
  ...rest
}: SegmentedControlProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      // Radix emits '' when the active item is pressed again; keep the selection.
      onValueChange={(v) => v && onValueChange(v as T)}
      aria-label={rest['aria-label']}
      className={cn('inline-flex w-full gap-1 rounded-full bg-surface-3 p-1', className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold text-label-secondary transition-colors duration-150 data-[state=on]:bg-surface-1 data-[state=on]:text-label data-[state=on]:shadow-card disabled:cursor-not-allowed disabled:opacity-40"
        >
          {o.icon}
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
