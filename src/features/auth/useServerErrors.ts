import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { errorMessage, fieldErrors } from '@/shared/api/errors'

/**
 * Applies a failed submit to a form: VALIDATION_FAILED details become field
 * errors; everything else becomes one friendly message for the form's `root`.
 * Returns the root message (or null) so callers can render it.
 */
export function applyServerError<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  knownFields: readonly string[],
): string | null {
  const fields = fieldErrors(err)
  let mapped = 0
  for (const [name, message] of Object.entries(fields)) {
    if (knownFields.includes(name)) {
      setError(name as Path<T>, { type: 'server', message })
      mapped++
    }
  }
  return mapped > 0 ? null : errorMessage(err)
}
