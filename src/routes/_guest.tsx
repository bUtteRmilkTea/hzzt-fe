import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { safeRedirect } from '@/app/redirect'
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
  // From 1024px: an animated brand panel on the left, the form on the right (F20). Below that,
  // the panel is gone and the form is a single centred column.
  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-2">
      <AuthPanel className="hidden lg:flex" />
      <div className="pt-safe grid min-h-dvh place-items-center px-4 py-10">
        <div className="w-full max-w-sm">
          <p className="mb-8 text-center text-2xl font-semibold lg:hidden">HZZT</p>
          <Outlet />
        </div>
      </div>
    </main>
  )
}
