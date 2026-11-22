import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { authedHandlers } from '../../test/msw/api'
import { server } from '../../test/msw/server'
import { renderApp } from '../../test/renderApp'

describe('signed in', () => {
  beforeEach(() => server.use(...authedHandlers))

  it('renders the home placeholder inside the shell', async () => {
    renderApp('/s/s-1')
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
  })

  it('shows who is signed in and signs out back to /login', async () => {
    const { router } = renderApp('/s/s-1')
    expect(await screen.findByText('jane@example.com')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it.each([
    ['/s/s-1/history', 'History'],
    ['/s/s-1/wallets', 'Wallets'],
    ['/s/s-1/assets', 'Assets'],
  ])('renders %s', async (path, title) => {
    renderApp(path)
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
  })

  it('shows a not-found state for an unknown path', async () => {
    renderApp('/definitely-not-a-route')
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })

  it('opens the add sheet from the centre add button', async () => {
    renderApp('/s/s-1')
    await userEvent.click(await screen.findByRole('button', { name: 'Add transaction' }))
    expect(await screen.findByRole('dialog', { name: 'Add transaction' })).toBeInTheDocument()
  })

  it('redirects away from /login to the active space home', async () => {
    const { router } = renderApp('/login')
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/s/s-1')
  })

  it('sends / to the active space', async () => {
    const { router } = renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/s/s-1')
  })
})

describe('public', () => {
  it('renders the gallery with every primitive and no crash (no login needed)', async () => {
    renderApp('/_gallery')
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
})
