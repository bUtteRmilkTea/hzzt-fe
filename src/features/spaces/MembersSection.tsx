import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useSession } from '@/app/providers/SessionProvider'
import { useSpace } from '@/app/providers/SpaceProvider'
import { api } from '@/shared/api/client'
import { errorMessage } from '@/shared/api/errors'
import { queryKeys } from '@/shared/api/queryKeys'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/Skeleton'
import { useToast } from '@/shared/ui/Toast'
import { useInvalidateSpaces, useMembers } from './hooks'

export const MEMBER_LIMIT = 5

interface Target {
  userId: string
  name: string
  self: boolean
}

export function MembersSection() {
  const { space, isOwner } = useSpace()
  const { user } = useSession()
  const navigate = useNavigate()
  const toast = useToast()
  const invalidateSpaces = useInvalidateSpaces()
  const queryClient = useQueryClient()
  const members = useMembers(space.id)
  const [target, setTarget] = useState<Target | null>(null)

  const remove = useMutation({
    mutationFn: async (userId: string) =>
      api.DELETE('/spaces/{spaceId}/members/{userId}', {
        params: { path: { spaceId: space.id, userId } },
      }),
    meta: { silent: true },
    onSuccess: async () => {
      const left = target?.self
      setTarget(null)
      await invalidateSpaces()
      await queryClient.invalidateQueries({ queryKey: queryKeys.space(space.id).members() })
      toast.show(left ? 'You left the space' : 'Member removed', 'success')
      if (left) await navigate({ to: '/' })
    },
    onError: (err) => {
      setTarget(null)
      toast.show(errorMessage(err), 'error')
    },
  })

  return (
    <section aria-labelledby="members-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 id="members-heading" className="text-lg font-medium">
          Members
        </h2>
        <span className="text-sm text-label-secondary">
          {space.memberCount} of {MEMBER_LIMIT}
        </span>
      </div>

      {members.isPending ? (
        <Skeleton className="h-16" />
      ) : members.isError ? (
        <EmptyState
          title="Couldn't load members"
          action={<Button onClick={() => void members.refetch()}>Try again</Button>}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {members.data.map((m) => {
            const self = m.userId === user?.id
            return (
              <li key={m.userId}>
                <Card className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {m.name}
                      {self ? ' (you)' : ''}
                    </p>
                    <p className="truncate text-sm text-label-secondary">
                      {m.email} · {m.role === 'OWNER' ? 'Owner' : 'Member'}
                    </p>
                  </div>
                  {m.userId && m.role !== 'OWNER' && (isOwner || self) ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setTarget({ userId: m.userId as string, name: m.name ?? '', self })
                      }
                    >
                      {self ? 'Leave' : 'Remove'}
                    </Button>
                  ) : null}
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {isOwner ? (
        <p className="text-sm text-label-tertiary">
          The owner can't leave the space. To step away, ask another member to take over first.
        </p>
      ) : null}

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title={target?.self ? 'Leave this space?' : `Remove ${target?.name ?? 'member'}?`}
        description={
          target?.self
            ? "You'll lose access to its wallets and transactions."
            : 'They will lose access to this space immediately.'
        }
        confirmLabel={target?.self ? 'Leave space' : 'Remove member'}
        destructive
        pending={remove.isPending}
        onConfirm={() => target && remove.mutate(target.userId)}
      />
    </section>
  )
}
