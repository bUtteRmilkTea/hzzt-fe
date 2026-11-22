import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { routeTree } from '@/routeTree.gen'
import { Providers } from './providers/Providers'

async function renderAt(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  await router.load()
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  )
}

describe('routes', () => {
  it('renders the home placeholder inside the shell', async () => {
    await renderAt('/')
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
  })

  it.each([
    ['/history', 'History'],
    ['/wallets', 'Wallets'],
    ['/assets', 'Assets'],
  ])('renders %s', async (path, title) => {
    await renderAt(path)
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
  })

  it('renders the gallery with every primitive and no crash', async () => {
    await renderAt('/_gallery')
    expect(await screen.findByRole('heading', { name: 'Component gallery' })).toBeInTheDocument()
    for (const region of [
      'Theme',
      'Buttons',
      'Amounts',
      'Form controls',
      'Money input',
      'States',
    ]) {
      expect(screen.getByRole('region', { name: region })).toBeInTheDocument()
    }
  })

  it('shows a not-found state for an unknown path', async () => {
    await renderAt('/definitely-not-a-route')
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })

  it('opens the add sheet from the centre add button', async () => {
    await renderAt('/')
    screen.getByRole('button', { name: 'Add transaction' }).click()
    expect(await screen.findByRole('dialog', { name: 'Add transaction' })).toBeInTheDocument()
  })
})
