import type { InputHTMLAttributes, Ref } from 'react'
import { cn } from './cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  /** Short text inside the left edge, such as a currency (`Rp`). It is decoration: put the unit in the label too. */
  prefix?: string
  ref?: Ref<HTMLInputElement>
}

export function Input({ className, invalid, ref, prefix, ...props }: InputProps) {
  const field = (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'min-h-12 w-full rounded-md border border-border bg-surface-2 px-4 text-base text-label placeholder:text-placeholder focus-visible:border-accent disabled:opacity-50',
        prefix && 'pl-12',
        invalid && 'border-negative',
        className,
      )}
      {...props}
    />
  )
  if (!prefix) return field
  return (
    <span className="relative block w-full">
      <span
        aria-hidden
        data-testid="input-prefix"
        className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-base text-label-secondary"
      >
        {prefix}
      </span>
      {field}
    </span>
  )
}
