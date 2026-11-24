import { useEffect, useRef, useState } from 'react'
import { errorMessage, toAppError } from '@/shared/api/errors'
import { Decimal } from '@/shared/money'
import { useToast } from '@/shared/ui/Toast'
import {
  assignedExcluding,
  checkTargetPct,
  useSetWrapperTarget,
  type WrapperTarget,
} from './wrappers'

interface Props {
  assetType: string
  wrapperKey: string
  wrapperLabel: string
  /** This wrapper's share of its category by value, from the data (display only). */
  actualPct: string
  targets: readonly WrapperTarget[]
  /** Unassigned investments have no wrapper to attach a target to. */
  disabled?: boolean
}

/**
 * Tap the target % to edit it in place: Enter or blur saves this one wrapper, Esc cancels.
 * Shows the actual share beside it and what is left in the category as a soft hint.
 */
export function WrapperPercentInline({
  assetType,
  wrapperKey,
  wrapperLabel,
  actualPct,
  targets,
  disabled,
}: Props) {
  const toast = useToast()
  const save = useSetWrapperTarget()
  const current = targets.find((t) => t.assetType === assetType && t.key === wrapperKey)
  const target = current?.targetPct ?? null
  const others = assignedExcluding(targets, assetType, wrapperKey)
  const left = new Decimal(100).minus(others).minus(target ?? 0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const done = useRef(false)

  useEffect(() => {
    if (editing) input.current?.select()
  }, [editing])

  const start = () => {
    done.current = false
    setDraft(target ?? '')
    setError(null)
    setEditing(true)
  }
  const commit = () => {
    if (done.current) return
    const check = checkTargetPct(draft, others)
    if (!check.ok) {
      setError(check.message)
      return
    }
    done.current = true
    setEditing(false)
    if (check.value === target) return
    save.mutate(
      { assetType, key: wrapperKey, targetPct: check.value },
      {
        onError: (e) =>
          toast.show(
            toAppError(e).code === 'ALLOCATION_EXCEEDS_100'
              ? `${wrapperLabel}: the targets in this category would pass 100%.`
              : errorMessage(e),
            'error',
          ),
      },
    )
  }

  if (disabled)
    return (
      <span className="tabular col-span-2 text-sm text-label-secondary sm:col-span-1 sm:justify-self-end">
        {actualPct}%
      </span>
    )

  const note = error ? (
    <span role="alert" className="col-span-full text-right text-sm text-negative">
      {error}
    </span>
  ) : left.isNegative() || (!editing && others.plus(target ?? 0).isZero()) ? null : (
    <span className="col-span-full text-right text-xs text-label-tertiary">
      {left.toFixed(2)}% left in category
    </span>
  )

  return (
    <>
      <div className="col-span-2 flex items-center gap-2 pb-1 text-sm sm:col-span-1 sm:justify-self-end sm:pb-0">
        <span className="tabular text-label-secondary" data-testid="wrapper-actual">
          {actualPct}%
        </span>
        {editing ? (
          <input
            ref={input}
            aria-label={`${wrapperLabel} target percent`}
            inputMode="decimal"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commit()
              } else if (e.key === 'Escape') {
                done.current = true
                setEditing(false)
                setError(null)
              }
            }}
            onBlur={commit}
            className="h-8 w-20 rounded-md border border-border-strong bg-surface-2 px-2 text-right"
          />
        ) : (
          <button
            type="button"
            onClick={start}
            aria-label={`${wrapperLabel} target ${target ? `${target}%` : 'not set'}, edit`}
            className="tabular min-h-8 rounded-md border border-dashed border-border-strong px-2 hover:bg-surface-3"
          >
            {target ? `Target ${target}%` : 'Set target'}
          </button>
        )}
      </div>
      {note}
    </>
  )
}
