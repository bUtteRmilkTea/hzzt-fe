import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { safeRedirect } from '@/app/redirect'
import { AuthBackground } from '@/features/auth/AuthBackground'
import { AuthPanel } from '@/features/auth/AuthPanel'

export const Route = createFileRoute('/_guest')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const r = safeRedirect(search.redirect)
    return r ? { redirect: r } : {}
  },
  // Signed-in users have no business on the auth screens.
  beforeLoad: ({ context, search }) => {
    if (context.session.status === 'authenticated') {
      // Re-check here: the raw search string can survive validateSearch.
      throw redirect({ to: safeRedirect(search.redirect) ?? '/' })
    }
  },
  component: GuestLayout,
})

function GuestLayout() {
  // One uniform page with an animated backdrop (F22). From 1024px the brand scene and the form sit
  // side by side as one centred group with a small gap and no divider. Below that, the scene is gone
  // and the form is a single centred column.
  return (
    <main className="pt-safe relative isolate min-h-dvh overflow-hidden bg-bg">
      <AuthBackground />
      <div className="mx-auto grid min-h-dvh max-w-5xl items-center gap-12 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-16">
        <AuthPanel className="hidden lg:flex" />
        <div className="mx-auto w-full max-w-sm">
          <p className="mb-8 text-center text-2xl font-medium lg:hidden">HZZT</p>
          <Outlet />
        </div>
      </div>
    </main>
  )
}
