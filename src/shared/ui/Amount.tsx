import { type FormatOptions, format, signOf } from '@/shared/money'
import { cn } from './cn'
import { usePrivacy } from './privacy'

interface AmountProps {
  /** API money string. Never a number. */
  value: string
  currency: string
  /** 'auto' colours by sign (income green, loss red); 'expense' is always red (outflows). Sign is always also shown as a glyph. */
  tone?: 'auto' | 'neutral' | 'expense'
  signDisplay?: FormatOptions['signDisplay']
  /** Short form (1.3M) for tight spaces such as calendar cells. */
  compact?: boolean
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
  compact,
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
        (tone === 'auto' ? sign < 0 : tone === 'expense' && sign !== 0) && 'text-negative',
        className,
      )}
    >
      {format(value, currency, { signDisplay, compact })}
    </span>
  )
}
