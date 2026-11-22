import type { InputHTMLAttributes, Ref } from 'react'
import { cn } from './cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  ref?: Ref<HTMLInputElement>
}

export function Input({ className, invalid, ref, ...props }: InputProps) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'min-h-11 w-full rounded-md border border-border bg-surface-2 px-4 text-base text-label placeholder:text-label-tertiary focus-visible:border-accent disabled:opacity-50',
        invalid && 'border-negative',
        className,
      )}
      {...props}
    />
  )
}
