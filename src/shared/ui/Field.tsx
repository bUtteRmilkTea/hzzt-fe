import { cloneElement, type ReactElement, useId } from 'react'
import { cn } from './cn'

interface FieldProps {
  label: string
  hint?: string
  error?: string
  className?: string
  /** A single form control. Field wires id, aria-describedby and aria-invalid onto it. */
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; invalid?: boolean }>
}

export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ')

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="text-sm font-medium text-label-secondary">
        {label}
      </label>
      {cloneElement(children, {
        id,
        'aria-describedby': describedBy || undefined,
        invalid: Boolean(error),
      })}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-negative">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-sm text-label-tertiary">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
