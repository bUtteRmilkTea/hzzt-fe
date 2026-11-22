import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router'
import { Settings } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { AppLockProvider } from '@/app/providers/AppLockProvider'
import { PreferencesProvider } from '@/app/providers/PreferencesProvider'
import { SpaceProvider, useSpace } from '@/app/providers/SpaceProvider'
import { Splash } from '@/app/Splash'
import { RevealAmountsButton } from '@/features/preferences/RevealAmountsButton'
import { SpaceSwitcher } from '@/features/spaces/SpaceSwitcher'
import { AppShell } from '@/shared/ui/AppShell'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'

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
  return (
    <SpaceProvider
      fallback={(state, retry) =>
        state === 'loading' ? (
          <Splash />
        ) : (
          <div className="mx-auto max-w-md p-6">
            <EmptyState
              title={state === 'error' ? "Couldn't load your spaces" : 'No space yet'}
              description={
                state === 'error'
                  ? 'Check your connection and try again.'
                  : 'Your account has no space. Please contact support.'
              }
              action={<Button onClick={retry}>Try again</Button>}
            />
          </div>
        )
      }
    >
      <PreferencesProvider fallback={<Splash />}>
        <AppLockProvider>
          <Shell />
        </AppLockProvider>
      </PreferencesProvider>
    </SpaceProvider>
  )
}

function Shell() {
  const { space } = useSpace()
  const [addOpen, setAddOpen] = useState(false)
  return (
    <AppShell
      spaceId={space.id}
      onAdd={() => setAddOpen(true)}
      header={
        <>
          <SpaceSwitcher />
          <div className="flex items-center gap-1">
            <RevealAmountsButton />
            <Link
              to="/settings"
              aria-label="Settings"
              className="inline-flex size-11 items-center justify-center rounded-full text-label-secondary hover:bg-surface-3"
            >
              <Settings aria-hidden className="size-5" />
            </Link>
          </div>
        </>
      }
    >
      <Outlet />
      {addOpen ? (
        <Suspense fallback={null}>
          <AddSheet open={addOpen} onOpenChange={setAddOpen} />
        </Suspense>
      ) : null}
    </AppShell>
  )
}
