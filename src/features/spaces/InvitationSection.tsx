import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSpace } from '@/app/providers/SpaceProvider'
import { api } from '@/shared/api/client'
import { errorMessage } from '@/shared/api/errors'
import { queryKeys } from '@/shared/api/queryKeys'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Skeleton } from '@/shared/ui/Skeleton'
import { useToast } from '@/shared/ui/Toast'
import { useActiveInvitation } from './hooks'
import { MEMBER_LIMIT } from './MembersSection'

/** Invitations expire after 7 days (backend rule). */
const EXPIRY_DAYS = 7

export function InvitationSection() {
  const { space } = useSpace()
  const toast = useToast()
  const queryClient = useQueryClient()
  const invitation = useActiveInvitation(space.id, true)
  const key = queryKeys.space(space.id).invitation()
  const full = space.memberCount >= MEMBER_LIMIT

  const create = useMutation({
    mutationFn: async () =>
      (await api.POST('/spaces/{spaceId}/invitations', { params: { path: { spaceId: space.id } } }))
        .data,
    meta: { silent: true },
    onSuccess: (dto) => queryClient.setQueryData(key, dto ?? null),
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })
  const revoke = useMutation({
    mutationFn: async () =>
      api.DELETE('/spaces/{spaceId}/invitations/active', {
        params: { path: { spaceId: space.id } },
      }),
    meta: { silent: true },
    onSuccess: () => {
      queryClient.setQueryData(key, null)
      toast.show('Invitation revoked', 'success')
    },
    onError: (err) => toast.show(errorMessage(err), 'error'),
  })

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.show('Link copied', 'success')
    } catch {
      toast.show("Couldn't copy. Select the link and copy it manually.", 'error')
    }
  }

  const active = invitation.data
  const link =
    active?.link || (active?.code ? `${window.location.origin}/invitations/${active.code}` : '')

  return (
    <section aria-labelledby="invite-heading" className="flex flex-col gap-3">
      <h2 id="invite-heading" className="text-lg font-medium">
        Invite someone
      </h2>
      <p className="text-sm text-label-secondary">
        A space holds up to {MEMBER_LIMIT} members. Invitation links expire after {EXPIRY_DAYS}{' '}
        days.
      </p>

      {invitation.isPending ? (
        <Skeleton className="h-24" />
      ) : active ? (
        <Card className="flex flex-col gap-3">
          <div>
            <p className="text-sm text-label-secondary">Invitation link</p>
            <p className="break-all font-mono text-sm" data-testid="invite-link">
              {link}
            </p>
            {active.expiresAt ? (
              <p className="mt-1 text-sm text-label-tertiary">
                Expires {new Date(active.expiresAt).toLocaleDateString()}
              </p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void copy(link)}>
              Copy link
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={revoke.isPending}
              onClick={() => revoke.mutate()}
            >
              Revoke
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <Button disabled={create.isPending || full} onClick={() => create.mutate()}>
            {create.isPending ? 'Generating…' : 'Generate invitation link'}
          </Button>
          {full ? (
            <p className="text-sm text-label-tertiary">
              This space is full. Remove a member to invite someone new.
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}
