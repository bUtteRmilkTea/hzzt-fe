import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { ERROR_COPY } from '@/shared/api/errors'
import type { components } from '@/shared/api/schema'
import {
  BASE,
  errorEnvelope,
  makeAuthedHandlers,
  ownerSpace,
  sharedSpace,
} from '../../../test/msw/api'
import { server } from '../../../test/msw/server'
import { renderApp } from '../../../test/renderApp'

type Space = components['schemas']['spaces.SpaceDTO']

const members = [
  { userId: 'u-1', name: 'Jane', email: 'jane@example.com', role: 'OWNER' },
  { userId: 'u-2', name: 'Bob', email: 'bob@example.com', role: 'MEMBER' },
]

describe('space switching', () => {
  beforeEach(() => server.use(...makeAuthedHandlers()))

  it('lists spaces with role and member count, and switches', async () => {
    const activated: string[] = []
    server.use(
      http.post(`${BASE}/spaces/:spaceId/activate`, ({ params }) => {
        activated.push(String(params.spaceId))
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    const { router } = renderApp('/s/s-1')
    expect(await screen.findByTestId('active-space')).toHaveTextContent('Home · IDR')

    await user.click(screen.getByRole('button', { name: /Switch space/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Your spaces' })
    expect(within(dialog).getByText('Owner · 2 members')).toBeInTheDocument()
    expect(within(dialog).getByText('Member · 3 members')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /Family/ }))
    await waitFor(() =>
      expect(screen.getByTestId('active-space')).toHaveTextContent('Family · USD'),
    )
    expect(router.state.location.pathname).toBe('/s/s-2')
    await waitFor(() => expect(activated).toContain('s-2'))
  })

  it('drops the previous space cache and never shows its data while the new one loads', async () => {
    server.use(
      http.get(`${BASE}/spaces/:spaceId/members`, async ({ params }) => {
        if (params.spaceId === 's-2') {
          await new Promise((r) => setTimeout(r, 80))
          return HttpResponse.json([
            { userId: 'u-9', name: 'Zed', email: 'z@example.com', role: 'MEMBER' },
          ])
        }
        return HttpResponse.json(members)
      }),
    )
    const user = userEvent.setup()
    const { queryClient } = renderApp('/s/s-1')
    await screen.findByTestId('active-space')
    // Seed some s-1 data in the cache, the way a wallets screen would.
    queryClient.setQueryData(['space', 's-1', 'wallets'], [{ name: 'Cash' }])
    expect(
      queryClient.getQueryCache().findAll({ queryKey: ['space', 's-1'] }).length,
    ).toBeGreaterThan(0)

    const seen: string[] = []
    const watch = new MutationObserver(() => {
      if (document.body.textContent?.includes('Bob')) seen.push('Bob')
    })
    watch.observe(document.body, { childList: true, subtree: true, characterData: true })

    await user.click(screen.getByRole('button', { name: /Switch space/ }))
    await user.click(await screen.findByRole('button', { name: /Family/ }))
    await waitFor(() => expect(screen.getByTestId('active-space')).toHaveTextContent('Family'))
    await waitFor(() =>
      expect(queryClient.getQueryCache().findAll({ queryKey: ['space', 's-1'] })).toHaveLength(0),
    )
    watch.disconnect()
    expect(seen).toEqual([])
  })

  it('creates a space and switches to it', async () => {
    let created: unknown
    const created_space = { ...ownerSpace, id: 's-3', name: 'Trip', memberCount: 1 }
    let spaces: Space[] = [ownerSpace, sharedSpace]
    server.use(
      http.get(`${BASE}/spaces`, () => HttpResponse.json(spaces)),
      http.post(`${BASE}/spaces`, async ({ request }) => {
        created = await request.json()
        spaces = [...spaces, created_space]
        return HttpResponse.json(created_space, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    const { router } = renderApp('/s/s-1')
    await user.click(await screen.findByRole('button', { name: /Switch space/ }))
    await user.click(await screen.findByRole('button', { name: 'Create space' }))
    const sheet = await screen.findByRole('dialog', { name: 'Create space' })
    await user.type(within(sheet).getByLabelText('Name'), 'Trip')
    await user.click(within(sheet).getByRole('button', { name: 'Create space' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/s/s-3'))
    expect(created).toMatchObject({ name: 'Trip', baseCurrency: 'IDR' })
  })

  it('requires a name to create a space', async () => {
    const user = userEvent.setup()
    renderApp('/s/s-1')
    await user.click(await screen.findByRole('button', { name: /Switch space/ }))
    await user.click(await screen.findByRole('button', { name: 'Create space' }))
    const sheet = await screen.findByRole('dialog', { name: 'Create space' })
    await user.click(within(sheet).getByRole('button', { name: 'Create space' }))
    expect(await within(sheet).findByText('Enter a name')).toBeInTheDocument()
  })
})

describe('space settings: owner versus member', () => {
  it('owner can edit and save, and sees the invitation section', async () => {
    let patch: Record<string, unknown> = {}
    server.use(
      ...makeAuthedHandlers(),
      http.get(`${BASE}/spaces/s-1/members`, () => HttpResponse.json(members)),
      http.get(`${BASE}/spaces/s-1/invitations/active`, () => HttpResponse.json({})),
      http.patch(`${BASE}/spaces/s-1`, async ({ request }) => {
        patch = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ ...ownerSpace, ...patch })
      }),
    )
    const user = userEvent.setup()
    renderApp('/settings/space')
    const name = await screen.findByLabelText('Name')
    expect(name).not.toHaveAttribute('readonly')
    expect(screen.getByRole('heading', { name: 'Invite someone' })).toBeInTheDocument()
    expect(screen.queryByText(/Only the space owner/)).not.toBeInTheDocument()

    const save = screen.getByRole('button', { name: 'Save changes' })
    expect(save).toBeDisabled() // nothing changed yet
    await user.clear(name)
    await user.type(name, 'Household')
    await user.click(save)
    await waitFor(() => expect(patch).toMatchObject({ name: 'Household', baseCurrency: 'IDR' }))
  })

  it('member sees owner-only fields read-only and never triggers a 403', async () => {
    const forbidden = vi.fn()
    server.use(
      ...makeAuthedHandlers({ lastActiveSpaceId: 's-2' }),
      http.get(`${BASE}/spaces/s-2/members`, () => HttpResponse.json(members)),
      // The owner-only endpoints. A member must never reach them.
      http.get(`${BASE}/spaces/s-2/invitations/active`, () => {
        forbidden('invitations')
        return HttpResponse.json(errorEnvelope('FORBIDDEN'), { status: 403 })
      }),
      http.patch(`${BASE}/spaces/s-2`, () => {
        forbidden('patch')
        return HttpResponse.json(errorEnvelope('FORBIDDEN'), { status: 403 })
      }),
    )
    renderApp('/settings/space')
    const name = await screen.findByLabelText('Name')
    expect(name).toHaveAttribute('readonly')
    expect(screen.getByLabelText(/Base currency/)).toBeDisabled()
    expect(screen.getByRole('switch', { name: 'Automatic currency conversion' })).toBeDisabled()
    expect(screen.getByText(/Only the space owner can change these settings/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Invite someone' })).not.toBeInTheDocument()
    await screen.findByText('Bob')
    expect(forbidden).not.toHaveBeenCalled()
  })
})

describe('members', () => {
  it('owner can remove another member (after confirming) but not themselves', async () => {
    const removed: string[] = []
    server.use(
      ...makeAuthedHandlers(),
      http.get(`${BASE}/spaces/s-1/members`, () => HttpResponse.json(members)),
      http.get(`${BASE}/spaces/s-1/invitations/active`, () => HttpResponse.json({})),
      http.delete(`${BASE}/spaces/s-1/members/:userId`, ({ params }) => {
        removed.push(String(params.userId))
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    renderApp('/settings/space')
    await screen.findByText('Bob')
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Leave' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    const confirm = await screen.findByRole('dialog', { name: 'Remove Bob?' })
    await user.click(within(confirm).getByRole('button', { name: 'Remove member' }))
    await waitFor(() => expect(removed).toEqual(['u-2']))
  })

  it('a member can leave, and lands back in a space they still belong to', async () => {
    const left: string[] = []
    let spaces: Space[] = [ownerSpace, sharedSpace]
    // MSW uses the first matching handler, so overrides go before the defaults.
    server.use(
      http.get(`${BASE}/spaces`, () => HttpResponse.json(spaces)),
      ...makeAuthedHandlers({ lastActiveSpaceId: 's-2' }),
      http.get(`${BASE}/spaces/s-2/members`, () =>
        HttpResponse.json([
          { userId: 'u-7', name: 'Owner', email: 'o@example.com', role: 'OWNER' },
          { userId: 'u-1', name: 'Jane', email: 'jane@example.com', role: 'MEMBER' },
        ]),
      ),
      http.delete(`${BASE}/spaces/s-2/members/:userId`, ({ params }) => {
        left.push(String(params.userId))
        spaces = [ownerSpace]
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    const { router } = renderApp('/settings/space')
    await screen.findByText('Jane (you)')
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Leave' }))
    const confirm = await screen.findByRole('dialog', { name: 'Leave this space?' })
    await user.click(within(confirm).getByRole('button', { name: 'Leave space' }))
    await waitFor(() => expect(left).toEqual(['u-1']))
    await waitFor(() => expect(router.state.location.pathname).toBe('/s/s-1'))
  })

  it('shows an error state with retry when members fail to load', async () => {
    server.use(
      ...makeAuthedHandlers(),
      http.get(`${BASE}/spaces/s-1/members`, () =>
        HttpResponse.json(errorEnvelope('INTERNAL_ERROR'), { status: 500 }),
      ),
      http.get(`${BASE}/spaces/s-1/invitations/active`, () => HttpResponse.json({})),
    )
    renderApp('/settings/space')
    expect(await screen.findByText("Couldn't load members")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

describe('invitations', () => {
  beforeEach(() =>
    server.use(
      ...makeAuthedHandlers(),
      http.get(`${BASE}/spaces/s-1/members`, () => HttpResponse.json(members)),
    ),
  )

  it('generates, copies and revokes a link, showing the 7-day expiry and member limit', async () => {
    let active: components['schemas']['spaces.ActiveInvitationResponse'] = {}
    server.use(
      http.get(`${BASE}/spaces/s-1/invitations/active`, () => HttpResponse.json(active)),
      http.post(`${BASE}/spaces/s-1/invitations`, () => {
        const inv = {
          code: 'abc123',
          link: 'http://localhost/invitations/abc123',
          expiresAt: '2026-12-01T00:00:00Z',
        }
        active = { invitation: inv }
        return HttpResponse.json(inv, { status: 201 })
      }),
      http.delete(`${BASE}/spaces/s-1/invitations/active`, () => {
        active = {}
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    renderApp('/settings/space')
    expect(await screen.findByText(/up to 5 members/)).toBeInTheDocument()
    expect(screen.getByText(/expire after 7 days/)).toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: 'Generate invitation link' }))
    expect(await screen.findByTestId('invite-link')).toHaveTextContent(
      'http://localhost/invitations/abc123',
    )

    await user.click(screen.getByRole('button', { name: 'Copy link' }))
    // user-event installs a working clipboard stub
    await waitFor(async () =>
      expect(await navigator.clipboard.readText()).toBe('http://localhost/invitations/abc123'),
    )

    await user.click(screen.getByRole('button', { name: 'Revoke' }))
    expect(
      await screen.findByRole('button', { name: 'Generate invitation link' }),
    ).toBeInTheDocument()
  })

  it('disables generating when the space is full', async () => {
    server.use(
      ...makeAuthedHandlers({ spaces: [{ ...ownerSpace, memberCount: 5 }] }),
      http.get(`${BASE}/spaces/s-1/members`, () => HttpResponse.json(members)),
      http.get(`${BASE}/spaces/s-1/invitations/active`, () => HttpResponse.json({})),
    )
    renderApp('/settings/space')
    expect(await screen.findByRole('button', { name: 'Generate invitation link' })).toBeDisabled()
    expect(screen.getByText(/This space is full/)).toBeInTheDocument()
  })
})

describe('accepting an invitation', () => {
  beforeEach(() => server.use(...makeAuthedHandlers()))

  it('joins and lands in the new space', async () => {
    const joined = { ...sharedSpace, id: 's-9', name: 'Flatmates' }
    let spaces: Space[] = [ownerSpace]
    server.use(
      http.get(`${BASE}/spaces`, () => HttpResponse.json(spaces)),
      http.post(`${BASE}/invitations/:code/accept`, () => {
        spaces = [ownerSpace, joined]
        return HttpResponse.json(joined)
      }),
    )
    const user = userEvent.setup()
    const { router } = renderApp('/invitations/abc123')
    await user.click(await screen.findByRole('button', { name: 'Accept invitation' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/s/s-9'))
    expect(await screen.findByTestId('active-space')).toHaveTextContent('Flatmates')
  })

  it.each<[string, number, string, string]>([
    [
      'INVITATION_EXPIRED',
      422,
      "Couldn't join this space",
      ERROR_COPY.INVITATION_EXPIRED as string,
    ],
    [
      'INVITATION_INVALID',
      422,
      "Couldn't join this space",
      ERROR_COPY.INVITATION_INVALID as string,
    ],
    [
      'SPACE_MEMBER_LIMIT',
      422,
      "Couldn't join this space",
      ERROR_COPY.SPACE_MEMBER_LIMIT as string,
    ],
    [
      'ALREADY_A_MEMBER',
      409,
      "You're already in this space",
      ERROR_COPY.ALREADY_A_MEMBER as string,
    ],
  ])('explains %s in plain words', async (code, status, title, copy) => {
    server.use(
      http.post(`${BASE}/invitations/:code/accept`, () =>
        HttpResponse.json(errorEnvelope(code), { status }),
      ),
    )
    const user = userEvent.setup()
    renderApp('/invitations/old')
    await user.click(await screen.findByRole('button', { name: 'Accept invitation' }))
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
    expect(screen.getByText(copy)).toBeInTheDocument()
    expect(document.body.textContent).not.toContain(code)
  })

  it('sends a signed-out visitor to log in first, then back to the invitation', async () => {
    server.resetHandlers() // signed out
    const { router } = renderApp('/invitations/abc123')
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(router.state.location.search).toMatchObject({ redirect: '/invitations/abc123' })
  })
})
