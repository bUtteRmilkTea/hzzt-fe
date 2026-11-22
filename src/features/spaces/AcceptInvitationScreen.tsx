import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { api } from '@/shared/api/client'
import { errorMessage, toAppError } from '@/shared/api/errors'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { useToast } from '@/shared/ui/Toast'
import { useInvalidateSpaces } from './hooks'

export function AcceptInvitationScreen() {
  const { code } = useParams({ from: '/_authed/invitations/$code' })
  const navigate = useNavigate()
  const toast = useToast()
  const invalidateSpaces = useInvalidateSpaces()

  const accept = useMutation({
    mutationFn: async () =>
      (await api.POST('/invitations/{code}/accept', { params: { path: { code } } })).data,
    meta: { silent: true }, // the outcome is rendered on this screen
    onSuccess: async (joined) => {
      await invalidateSpaces()
      toast.show('You joined the space', 'success')
      if (joined?.id) await navigate({ to: '/s/$spaceId', params: { spaceId: joined.id } })
    },
  })

  if (accept.isError) {
    const err = toAppError(accept.error)
    const alreadyMember = err.code === 'ALREADY_A_MEMBER'
    return (
      <div className="mx-auto max-w-md pt-8">
        <EmptyState
          title={alreadyMember ? "You're already in this space" : "Couldn't join this space"}
          description={errorMessage(err)}
          action={
            <Button asChild>
              <Link to="/">{alreadyMember ? 'Go to my space' : 'Back to home'}</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md pt-8">
      <EmptyState
        title="You've been invited to a space"
        description="Accept to share its wallets and transactions with its members."
        action={
          <Button disabled={accept.isPending} onClick={() => accept.mutate()}>
            {accept.isPending ? 'Joining…' : 'Accept invitation'}
          </Button>
        }
      />
    </div>
  )
}
