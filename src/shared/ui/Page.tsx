import type { HTMLAttributes } from 'react'
import { cn } from './cn'

/** `wide`: dashboards and lists (max 1200px). `form`: forms, detail and settings screens (max 960px). */
export type PageWidth = 'wide' | 'form'

interface PageProps extends HTMLAttributes<HTMLDivElement> {
  width?: PageWidth
  /** Vertical gap between children, in the spacing scale. */
  gap?: 4 | 5 | 6 | 8
}

const WIDTH: Record<PageWidth, string> = {
  wide: 'max-w-[var(--page-max-wide)]',
  form: 'max-w-[var(--page-max-form)]',
}

const GAP = { 4: 'gap-4', 5: 'gap-5', 6: 'gap-6', 8: 'gap-8' } as const

/**
 * The one page container. Every screen uses it, so widths never drift per page.
 * The AppShell already supplies the outer gutter; `--gutter` is exposed for inner layouts.
 */
export function Page({ width = 'wide', gap = 4, className, ...props }: PageProps) {
  return (
    <div
      className={cn('mx-auto flex w-full min-w-0 flex-col', WIDTH[width], GAP[gap], className)}
      {...props}
    />
  )
}
