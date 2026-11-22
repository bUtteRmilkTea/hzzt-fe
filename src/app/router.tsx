import { createRouter, type RouterHistory } from '@tanstack/react-router'
import type { RouterContext } from '@/app/routerContext'
import { routeTree } from '@/routeTree.gen'

export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    defaultPreload: 'intent',
    history,
    // The real value is supplied by <App> from the live session.
    context: undefined as unknown as RouterContext,
  })
}

export const router = createAppRouter()

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
