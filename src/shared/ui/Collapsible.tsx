import type { HTMLAttributes } from 'react'
import { cn } from './cn'

interface CollapsibleProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean
}

/**
 * Height-animated disclosure with no measuring: the grid row goes 0fr to 1fr.
 * Closed content is `inert`, so it cannot be focused or read by assistive technology.
 * The global reduced-motion rule makes the transition instant.
 */
export function Collapsible({ open, className, children, ...props }: CollapsibleProps) {
  return (
    <div
      data-state={open ? 'open' : 'closed'}
      className={cn(
        'grid transition-[grid-template-rows] duration-[var(--dur-base)] ease-out',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        className,
      )}
      {...props}
    >
      <div inert={!open} className="min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
