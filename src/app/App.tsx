import { RouterProvider } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useSession } from '@/app/providers/SessionProvider'
import { router as defaultRouter } from '@/app/router'
import { Splash } from '@/app/Splash'
import { OfflineBanner } from '@/shared/pwa/OfflineBanner'
import { UpdatePrompt } from '@/shared/pwa/UpdatePrompt'

/** Renders the router once the session is known, and re-runs route guards when it changes. */
export function App({ router = defaultRouter }: { router?: typeof defaultRouter }) {
  const session = useSession()

  // biome-ignore lint/correctness/useExhaustiveDependencies: guards must re-run whenever status or user changes
  useEffect(() => {
    if (session.status !== 'loading') router.invalidate()
  }, [router, session.status, session.user])

  if (session.status === 'loading') return <Splash />
  return (
    <>
      <OfflineBanner />
      <RouterProvider router={router} context={{ session }} />
      <UpdatePrompt />
    </>
  )
}
