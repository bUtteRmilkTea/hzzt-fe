// biome-ignore-all lint/plugin: fixtures only
import { screen } from '@testing-library/react'
import { makeAuthedHandlers } from '../../../test/msw/api'
import { server } from '../../../test/msw/server'
import { renderApp } from '../../../test/renderApp'

beforeEach(() => server.use(...makeAuthedHandlers()))

describe('PageHeader (D-F52)', () => {
  it('keeps the page name as a screen reader heading, drawn nowhere, and no toolbar without back or action', async () => {
    renderApp('/settings')
    const h1 = await screen.findByRole('heading', { level: 1, name: 'Settings' })
    expect(h1).toHaveClass('sr-only')
    expect(screen.queryByRole('link', { name: 'Back to settings' })).not.toBeInTheDocument()
  })

  it('keeps the back link in a title-less toolbar', async () => {
    renderApp('/settings/profile')
    const h1 = await screen.findByRole('heading', { level: 1, name: 'Profile' })
    expect(h1).toHaveClass('sr-only')
    expect(screen.getByRole('link', { name: 'Back to settings' })).toBeInTheDocument()
  })
})
