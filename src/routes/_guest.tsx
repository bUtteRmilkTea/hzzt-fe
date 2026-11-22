import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { safeRedirect } from '@/app/redirect'

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
  return (
    <main className="pt-safe grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="mb-8 text-center text-2xl font-semibold">HZZT</p>
        <Outlet />
      </div>
    </main>
  )
}
