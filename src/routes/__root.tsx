import { createRootRoute, type ErrorComponentProps, Link, Outlet } from '@tanstack/react-router'
import { lazy, Suspense, useState } from 'react'
import { AppShell } from '@/shared/ui/AppShell'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'

// The sheet (Vaul + Radix Dialog) is only needed once opened, so it loads on demand.
const AddSheet = lazy(() => import('@/app/AddSheet'))

export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: RootError,
  notFoundComponent: NotFound,
})

function RootLayout() {
  const [addOpen, setAddOpen] = useState(false)
  return (
    <AppShell onAdd={() => setAddOpen(true)}>
      <Outlet />
      {addOpen ? (
        <Suspense fallback={null}>
          <AddSheet open={addOpen} onOpenChange={setAddOpen} />
        </Suspense>
      ) : null}
    </AppShell>
  )
}

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
    <div className="mx-auto max-w-md">
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
