import { createMemoryHistory } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import { App } from '@/app/App'
import { Providers } from '@/app/providers/Providers'
import { createAppRouter } from '@/app/router'
import { createQueryClient } from '@/shared/api/queryClient'

/** Mounts the whole app (providers, session boot, router) at a path. */
export function renderApp(path = '/') {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  const queryClient = createQueryClient(() => {})
  // Fail fast in tests: no retry delay before an error state shows.
  queryClient.setDefaultOptions({
    ...queryClient.getDefaultOptions(),
    queries: { ...queryClient.getDefaultOptions().queries, retry: false },
  })
  const utils = render(
    <Providers queryClient={queryClient}>
      <App router={router} />
    </Providers>,
  )
  return { router, queryClient, ...utils }
}
