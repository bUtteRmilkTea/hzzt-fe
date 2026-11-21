import { Delete } from 'lucide-react'
import { cn } from '@/shared/ui/cn'
import { PIN_MAX, PIN_MIN } from './pin'

interface PinPadProps {
  value: string
  onChange: (pin: string) => void
  disabled?: boolean
  label?: string
}

/** Numeric PIN entry: dots plus a 3x4 keypad. Accepts 4 to 6 digits. */
export function PinPad({ value, onChange, disabled, label = 'PIN' }: PinPadProps) {
  const press = (d: string) => value.length < PIN_MAX && onChange(value + d)
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'] as const
  return (
    <div className="flex flex-col items-center gap-6">
      <div
        role="img"
        aria-label={`${label}: ${value.length} of ${PIN_MIN} to ${PIN_MAX} digits entered`}
        className="flex gap-3"
      >
        {Array.from({ length: PIN_MAX }, (_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length decorative dots
            key={i}
            className={cn(
              'size-3.5 rounded-full border border-border-strong',
              i < value.length && 'border-label bg-label',
              i >= PIN_MIN && i >= value.length && 'opacity-40',
            )}
          />
        ))}
      </div>
      <div className="grid w-64 grid-cols-3 gap-3">
        {keys.map((k) =>
          k === '' ? (
            <span key="blank" />
          ) : (
            <button
              key={k}
              type="button"
              disabled={disabled}
              aria-label={k === 'back' ? 'Delete digit' : k}
              onClick={() => (k === 'back' ? onChange(value.slice(0, -1)) : press(k))}
              className="flex size-[72px] items-center justify-center justify-self-center rounded-full bg-surface-3 text-xl font-medium transition-transform duration-100 active:scale-95 disabled:opacity-40"
            >
              {k === 'back' ? <Delete aria-hidden className="size-6" /> : k}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
