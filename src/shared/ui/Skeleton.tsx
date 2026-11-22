import type { HTMLAttributes } from 'react'
import { cn } from './cn'

/** Shape it like the real content (size via className). Never a full-page spinner. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-surface-3', className)}
      {...props}
    />
  )
}
