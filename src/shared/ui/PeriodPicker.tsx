import { CalendarDays, Check } from 'lucide-react'
import { useState } from 'react'
import { isValidDay, PERIOD_PRESETS, type Period, periodsEqual } from '@/shared/period'
import { periodLabel } from '@/shared/period/format'
import { Button } from './Button'
import { cn } from './cn'
import { Field } from './Field'
import { Input } from './Input'
import { SheetShell } from './SheetShell'

interface PeriodPickerProps {
  value: Period
  onChange: (p: Period) => void
  className?: string
}

/** Period presets plus a custom range. The value lives in the URL, so it survives a reload. */
export function PeriodPicker({ value, onChange, className }: PeriodPickerProps) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(value.kind === 'range' ? value.from : '')
  const [to, setTo] = useState(value.kind === 'range' ? value.to : '')
  const rangeInvalid = !isValidDay(from) || !isValidDay(to)

  const choose = (p: Period) => {
    onChange(p)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface-1 px-4 text-sm font-medium',
          className,
        )}
      >
        <CalendarDays aria-hidden className="size-4 text-label-secondary" />
        {periodLabel(value)}
      </button>

      <SheetShell open={open} onOpenChange={setOpen} title="Period">
        <ul className="flex flex-col">
          {PERIOD_PRESETS.map((p) => {
            const selected = periodsEqual(value, { kind: 'preset', preset: p.value })
            return (
              <li key={p.value}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => choose({ kind: 'preset', preset: p.value })}
                  className="flex min-h-12 w-full items-center justify-between rounded-md px-2 text-left hover:bg-surface-3"
                >
                  {p.label}
                  {selected ? <Check aria-hidden className="size-5 text-accent" /> : null}
                </button>
              </li>
            )
          })}
        </ul>

        <fieldset className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
          <legend className="text-sm font-medium text-label-secondary">Custom range</legend>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
          <Button
            variant="secondary"
            disabled={rangeInvalid}
            onClick={() =>
              choose(
                from <= to ? { kind: 'range', from, to } : { kind: 'range', from: to, to: from },
              )
            }
          >
            Apply range
          </Button>
        </fieldset>
      </SheetShell>
    </>
  )
}
