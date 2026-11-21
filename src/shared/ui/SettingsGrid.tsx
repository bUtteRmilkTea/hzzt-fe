import type { HTMLAttributes } from 'react'
import { cn } from './cn'

/**
 * The Settings area's shared body (F19, D-F24): two columns from 1024px, one below. Every page in
 * the area (Settings, Profile, Space, Security, Currency) puts its blocks in <SettingsCol>s, so they
 * all fill the wide page the same way instead of being a narrow single column. Columns top-align,
 * so a short column never leaves a gap in the middle.
 */
export function SettingsGrid({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-testid="settings-grid"
      className={cn('grid items-start gap-6 lg:grid-cols-2 lg:gap-8', className)}
      {...props}
    />
  )
}

export function SettingsCol({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex min-w-0 flex-col gap-6', className)} {...props} />
}
