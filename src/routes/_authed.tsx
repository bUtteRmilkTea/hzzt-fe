import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { lazy, Suspense, useState } from 'react'
import { AppShell } from '@/shared/ui/AppShell'

// The sheet (Vaul + Radix Dialog) is only needed once opened, so it loads on demand.
const AddSheet = lazy(() => import('@/app/AddSheet'))

export const Route = createFileRoute('/_authed')({
  // Protected area: send signed-out users to /login, remembering where they were going.
  beforeLoad: ({ context, location }) => {
    if (context.session.status === 'unauthenticated') {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
  component: AuthedLayout,
})

function AuthedLayout() {
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
