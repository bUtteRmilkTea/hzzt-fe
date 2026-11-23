import { ChevronDown } from 'lucide-react'
import type { Ref, SelectHTMLAttributes } from 'react'
import { cn } from './cn'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
  ref?: Ref<HTMLSelectElement>
}

/** Native select, restyled. Best touch UX on mobile and fully accessible out of the box. */
export function Select({ className, invalid, children, ref, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'min-h-12 w-full appearance-none rounded-md border border-border bg-surface-2 py-0 pr-10 pl-4 text-base text-label focus-visible:border-accent disabled:opacity-50',
          invalid && 'border-negative',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-label-tertiary"
      />
    </div>
  )
}
