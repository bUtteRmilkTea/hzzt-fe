import { createMemoryHistory } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import { App } from '@/app/App'
import { Providers } from '@/app/providers/Providers'
import { createAppRouter } from '@/app/router'

/** Mounts the whole app (providers, session boot, router) at a path. */
export function renderApp(path = '/') {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  const utils = render(
    <Providers>
      <App router={router} />
    </Providers>,
  )
  return { router, ...utils }
}
