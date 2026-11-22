import { useState } from 'react'
import { useSpace } from '@/app/providers/SpaceProvider'
import { errorMessage } from '@/shared/api/errors'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Field } from '@/shared/ui/Field'
import { Page } from '@/shared/ui/Page'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Select } from '@/shared/ui/Select'
import { Skeleton } from '@/shared/ui/Skeleton'
import { useToast } from '@/shared/ui/Toast'
import { useAnswerInvitation, useSharedInvitations } from './hooks'
import { bpsToPct } from './valuation'

/** Invitations to share someone else's investment. Accepting attaches it to a space of yours. */
export function InvitationsScreen() {
  const { spaces, space } = useSpace()
  const toast = useToast()
  const invitations = useSharedInvitations()
  const answer = useAnswerInvitation()
  const [chosen, setChosen] = useState<Record<string, string>>({})

  return (
    <Page width="form">
      <PageHeader title="Shared investments" />
      {invitations.isPending ? (
        <Skeleton className="h-28" />
      ) : invitations.isError ? (
        <EmptyState
          title="Couldn't load invitations"
          action={<Button onClick={() => void invitations.refetch()}>Try again</Button>}
        />
      ) : invitations.data.length === 0 ? (
        <EmptyState
          title="No invitations"
          description="When someone shares an investment with you, it shows up here."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {invitations.data.map((inv) => {
            const pid = inv.participantId as string
            const investment = (inv.investment ?? {}) as {
              name?: string
              symbol?: string
              icon?: string
            }
            const spaceId = chosen[pid] ?? space.id
            return (
              <li key={pid}>
                <Card className="flex flex-col gap-3">
                  <div>
                    <p className="font-medium">
                      <span aria-hidden>{investment.icon}</span> {investment.name}{' '}
                      {investment.symbol ? `(${investment.symbol})` : ''}
                    </p>
                    <p className="text-sm text-label-secondary">
                      From {inv.ownerName} · your share {inv.sharePct ?? bpsToPct(inv.shareBps)}%
                    </p>
                  </div>
                  <Field label="Add it to space">
                    <Select
                      value={spaceId}
                      onChange={(e) => setChosen({ ...chosen, [pid]: e.target.value })}
                    >
                      {spaces.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.avatarEmoji} {s.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="flex gap-3">
                    <Button
                      className="flex-1"
                      disabled={answer.isPending}
                      onClick={() =>
                        answer.mutate(
                          { participantId: pid, accept: { spaceId } },
                          {
                            onSuccess: () => toast.show('Added to your space', 'success'),
                            onError: (e) => toast.show(errorMessage(e), 'error'),
                          },
                        )
                      }
                    >
                      Accept
                    </Button>
                    <Button
                      className="flex-1"
                      variant="secondary"
                      disabled={answer.isPending}
                      onClick={() =>
                        answer.mutate(
                          { participantId: pid, accept: null },
                          {
                            onSuccess: () => toast.show('Declined', 'success'),
                            onError: (e) => toast.show(errorMessage(e), 'error'),
                          },
                        )
                      }
                    >
                      Decline
                    </Button>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </Page>
  )
}
