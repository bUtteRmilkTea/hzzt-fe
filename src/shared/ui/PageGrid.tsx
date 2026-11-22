import type { HTMLAttributes } from 'react'
import { cardClass } from './Card'
import { cn } from './cn'

/** 12-column page grid: single column on mobile, 12 columns from `lg` (1024px). */
export function PageGrid({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6', className)} {...props} />
  )
}

/** Column spans for a PageGrid child. Full class names so Tailwind can see them. */
export const SPAN = {
  4: 'lg:col-span-4',
  5: 'lg:col-span-5',
  6: 'lg:col-span-6',
  7: 'lg:col-span-7',
  8: 'lg:col-span-8',
  12: 'lg:col-span-12',
} as const

interface PanelProps extends HTMLAttributes<HTMLElement> {
  span?: keyof typeof SPAN
}

/** A grid cell: hairline-bordered surface that spans `span` of 12 columns from `lg`. */
export function Panel({ span = 12, className, ...props }: PanelProps) {
  return <section className={cn(cardClass, SPAN[span], className)} {...props} />
}

/** Responsive equal-width card grid: 1 column, 2 from `lg`, 3 from `xl`. */
export function CardGrid({ className, ...props }: HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      className={cn(
        'grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6 xl:grid-cols-3 2xl:grid-cols-4',
        className,
      )}
      {...props}
    />
  )
}
