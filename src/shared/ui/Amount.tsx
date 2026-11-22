import { type FormatOptions, format, signOf } from '@/shared/money'
import { cn } from './cn'
import { usePrivacy } from './privacy'

interface AmountProps {
  /** API money string. Never a number. */
  value: string
  currency: string
  /** Colour by sign (income green, expense red). Sign is always also shown as a glyph. */
  tone?: 'auto' | 'neutral'
  signDisplay?: FormatOptions['signDisplay']
  className?: string
}

/**
 * The only component that renders money. When amounts are masked the money
 * string is not rendered at all, so nothing leaks into the DOM or to a screen reader.
 */
export function Amount({
  value,
  currency,
  tone = 'neutral',
  signDisplay = 'auto',
  className,
}: AmountProps) {
  const { masked } = usePrivacy()

  if (masked) {
    return (
      <span
        role="img"
        aria-label="Amount hidden"
        className={cn('tabular select-none text-label-secondary blur-[2px]', className)}
        data-masked="true"
      >
        •••••
      </span>
    )
  }

  const sign = signOf(value)
  return (
    <span
      className={cn(
        'tabular',
        tone === 'auto' && sign > 0 && 'text-positive',
        tone === 'auto' && sign < 0 && 'text-negative',
        className,
      )}
    >
      {format(value, currency, { signDisplay })}
    </span>
  )
}
