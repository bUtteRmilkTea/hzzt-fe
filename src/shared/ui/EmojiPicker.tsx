import { cn } from './cn'
import { Input } from './Input'

const EMOJI = [
  '🏠',
  '👨‍👩‍👧',
  '💼',
  '🏦',
  '💰',
  '💳',
  '🪙',
  '📈',
  '🛒',
  '🍜',
  '☕',
  '🚗',
  '✈️',
  '🎓',
  '🏥',
  '🎁',
  '🎮',
  '🐶',
  '🌴',
  '🧾',
  '🏷️',
  '⭐',
  '🔥',
  '🌱',
] as const

interface EmojiPickerProps {
  value: string
  onChange: (emoji: string) => void
  label?: string
}

/** A small curated grid plus a free-text field for any other emoji. */
export function EmojiPicker({ value, onChange, label = 'Emoji' }: EmojiPickerProps) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium text-label-secondary">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {EMOJI.map((e) => (
          <button
            key={e}
            type="button"
            aria-label={`Emoji ${e}`}
            aria-pressed={value === e}
            onClick={() => onChange(e)}
            className={cn(
              'flex size-12 items-center justify-center rounded-md bg-surface-3 text-xl',
              value === e && 'ring-2 ring-accent',
            )}
          >
            {e}
          </button>
        ))}
      </div>
      <Input
        aria-label="Custom emoji"
        placeholder="Or type any emoji"
        value={EMOJI.some((e) => e === value) ? '' : value}
        maxLength={8}
        onChange={(e) => e.target.value && onChange(e.target.value)}
      />
    </fieldset>
  )
}
