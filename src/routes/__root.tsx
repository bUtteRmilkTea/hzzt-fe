import {
  createRootRouteWithContext,
  type ErrorComponentProps,
  Link,
  Outlet,
} from '@tanstack/react-router'
import type { RouterContext } from '@/app/routerContext'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'

export const Route = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
  errorComponent: RootError,
  notFoundComponent: NotFound,
})

/** Root boundary: catches render crashes and offers a reload. */
function RootError({ error }: ErrorComponentProps) {
  return (
    <div className="mx-auto max-w-md p-6">
      <EmptyState
        title="Something went wrong"
        description={
          error instanceof Error && error.message ? error.message : 'An unexpected error occurred.'
        }
        action={<Button onClick={() => window.location.reload()}>Reload</Button>}
      />
    </div>
  )
}

function NotFound() {
  return (
    <div className="mx-auto max-w-md p-6">
      <EmptyState
        title="Page not found"
        action={
          <Button asChild>
            <Link to="/">Go home</Link>
          </Button>
        }
      />
    </div>
  )
}
