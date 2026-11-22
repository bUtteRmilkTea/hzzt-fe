import type { HTMLAttributes } from 'react'
import { cn } from './cn'

/**
 * The one card surface: same radius, border, padding and shadow on every screen. Anything that
 * looks like a card uses this class (directly or through <Card>), so spacing never drifts.
 */
export const cardClass =
  'min-w-0 rounded-lg border border-border bg-surface-1 p-4 shadow-card lg:p-5'

/** Adds a hover lift and a press response. For cards that are links or buttons. */
export const cardInteractive = 'card-interactive'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Lift on hover and sink on press. Use only when the whole card is clickable. */
  interactive?: boolean
}

export function Card({ className, interactive, ...props }: CardProps) {
  return <div className={cn(cardClass, interactive && cardInteractive, className)} {...props} />
}
