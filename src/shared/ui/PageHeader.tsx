import { Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  /** Show a back link to the settings index. */
  backToSettings?: boolean
  action?: ReactNode
}

/**
 * D-F52: no page shows a visible title. The title stays as a screen reader heading (one `h1` per
 * page, the router tests and the outline rely on it). The back link and the page action live in a
 * title-less toolbar that exists only when there is one of them. Do not draw the title again.
 */
export function PageHeader({ title, backToSettings, action }: PageHeaderProps) {
  return (
    <>
      <h1 className="sr-only">{title}</h1>
      {backToSettings || action ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center">
            {backToSettings ? (
              <Link
                to="/settings"
                aria-label="Back to settings"
                className="-ml-3 inline-flex size-12 items-center justify-center rounded-full text-label-secondary hover:bg-surface-3"
              >
                <ChevronLeft aria-hidden className="size-6" />
              </Link>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
    </>
  )
}
