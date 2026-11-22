import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { Settings } from 'lucide-react'
import { AppLockProvider } from '@/app/providers/AppLockProvider'
import { PreferencesProvider } from '@/app/providers/PreferencesProvider'
import { SpaceProvider, useSpace } from '@/app/providers/SpaceProvider'
import { Splash } from '@/app/Splash'
import { RevealAmountsButton } from '@/features/preferences/RevealAmountsButton'
import { SpaceSwitcher } from '@/features/spaces/SpaceSwitcher'
import { returnToFor } from '@/features/transactions/returnTo'
import { MotionRoot } from '@/shared/motion/MotionRoot'
import { AppShell } from '@/shared/ui/AppShell'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'

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
  const navigate = useNavigate()
  const router = useRouter()
  return (
    <MotionRoot>
      <AppShell
        spaceId={space.id}
        onAdd={() => {
          // Remember where the user was, so Cancel and Save come back here (not to History).
          const returnTo = returnToFor(router.state.location)
          void navigate({
            to: '/s/$spaceId/transactions/new',
            params: { spaceId: space.id },
            search: { type: 'EXPENSE', ...(returnTo ? { returnTo } : {}) },
          })
        }}
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
      </AppShell>
    </MotionRoot>
  )
}
