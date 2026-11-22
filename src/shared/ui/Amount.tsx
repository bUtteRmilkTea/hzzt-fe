import { type FormatOptions, format, signOf } from '@/shared/money'
import { cn } from './cn'
import { usePrivacy } from './privacy'
import { useCountUp } from './useCountUp'

interface AmountProps {
  /** API money string. Never a number. */
  value: string
  currency: string
  /** 'auto' colours by sign (income green, loss red); 'expense' is always red (outflows). Sign is always also shown as a glyph. */
  tone?: 'auto' | 'neutral' | 'expense'
  signDisplay?: FormatOptions['signDisplay']
  /** Short form (1.3M) for tight spaces such as calendar cells. */
  compact?: boolean
  /**
   * Count up to the value once, and again when it changes. Use on ONE hero number per screen
   * region. Never animates while amounts are hidden or under reduced motion.
   */
  animate?: boolean
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
  animate,
  className,
}: AmountProps) {
  const { masked } = usePrivacy()
  // Hooks run before the masked early return. While masked the hook is disabled, so no frame is computed.
  const shown = useCountUp(value, Boolean(animate) && !masked)

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
  const toneClass = cn(
    tone === 'auto' && sign > 0 && 'text-positive',
    (tone === 'auto' ? sign < 0 : tone === 'expense' && sign !== 0) && 'text-negative',
  )
  const finalText = format(value, currency, { signDisplay, compact })

  if (animate) {
    // The real text is the final value: it sizes the box (so counting never shifts layout) and is
    // what screen readers and copy/paste get. The counting frame is painted by CSS from `data-frame`
    // on top of it, so no intermediate figure is ever part of the page text.
    return (
      <span className={cn('tabular relative inline-block', toneClass, className)}>
        <span className="opacity-0">{finalText}</span>
        <span
          aria-hidden
          data-frame={format(shown, currency, { signDisplay, compact })}
          data-counting={shown !== value || undefined}
          className="absolute inset-0 text-[inherit] after:content-[attr(data-frame)]"
        />
      </span>
    )
  }

  return <span className={cn('tabular', toneClass, className)}>{finalText}</span>
}
