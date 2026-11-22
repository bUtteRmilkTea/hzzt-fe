import {
  createRootRouteWithContext,
  type ErrorComponentProps,
  Link,
  Outlet,
} from '@tanstack/react-router'
import type { RouterContext } from '@/app/routerContext'

export const Route = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
  errorComponent: RootError,
  notFoundComponent: NotFound,
})

// These two fallbacks load with the entry chunk, so they use plain markup and Tailwind classes
// (no Button / EmptyState / cn) to keep tailwind-merge out of the initial bundle.
const card =
  'mx-auto mt-10 flex max-w-md flex-col items-center gap-3 rounded-lg border border-border bg-surface-1 px-6 py-10 text-center'
const button =
  'mt-2 inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 font-semibold text-accent-label'

/** Root boundary: catches render crashes and offers a reload. */
function RootError({ error }: ErrorComponentProps) {
  return (
    <div className={card}>
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="max-w-xs text-sm text-label-secondary">
        {error instanceof Error && error.message ? error.message : 'An unexpected error occurred.'}
      </p>
      <button type="button" className={button} onClick={() => window.location.reload()}>
        Reload
      </button>
    </div>
  )
}

function NotFound() {
  return (
    <div className={card}>
      <h2 className="text-lg font-semibold">Page not found</h2>
      <Link to="/" className={button}>
        Go home
      </Link>
    </div>
  )
}
