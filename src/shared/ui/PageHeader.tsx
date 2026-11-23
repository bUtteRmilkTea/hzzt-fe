import { Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  /** Show a back link to the settings index. */
  backToSettings?: boolean
  action?: ReactNode
}

export function PageHeader({ title, backToSettings, action }: PageHeaderProps) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-1">
        {backToSettings ? (
          <Link
            to="/settings"
            aria-label="Back to settings"
            className="-ml-3 inline-flex size-12 items-center justify-center rounded-full text-label-secondary hover:bg-surface-3"
          >
            <ChevronLeft aria-hidden className="size-6" />
          </Link>
        ) : null}
        <h1 className="text-xl font-medium">{title}</h1>
      </div>
      {action}
    </div>
  )
}
