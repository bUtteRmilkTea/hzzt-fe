import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

interface TwoColumnProps extends HTMLAttributes<HTMLDivElement> {
  left: ReactNode
  right: ReactNode
}

/**
 * Two independent columns from `lg` (1024px), stacked below. Each column is its own flex
 * stack, so expanding a card in one never stretches or moves a card in the other
 * (a CSS grid would stretch rows to the tallest neighbour).
 */
export function TwoColumn({ left, right, className, ...props }: TwoColumnProps) {
  return (
    <div className={cn('flex flex-col gap-4 lg:flex-row lg:items-start', className)} {...props}>
      <div className="flex min-w-0 flex-1 flex-col gap-4" data-column="left">
        {left}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4" data-column="right">
        {right}
      </div>
    </div>
  )
}
