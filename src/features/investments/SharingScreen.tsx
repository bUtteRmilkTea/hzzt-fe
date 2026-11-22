import { useParams } from '@tanstack/react-router'
import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSpace } from '@/app/providers/SpaceProvider'
import { errorMessage, toAppError } from '@/shared/api/errors'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { cn } from '@/shared/ui/cn'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Skeleton } from '@/shared/ui/Skeleton'
import { useToast } from '@/shared/ui/Toast'
import { useInvestment, useParticipants, useSetParticipants } from './hooks'
import {
  MAX_PARTICIPANTS,
  type ShareRow,
  shareProblem,
  shareTotal,
  toParticipantsBody,
} from './shares'
import { isSharedIn } from './valuation'

let seq = 0
const key = () => `row-${++seq}`

/** Owner-only: edit who shares an investment. A full replacement, submittable only at exactly 100.00%. */
export function SharingScreen() {
  const { space } = useSpace()
  const { id } = useParams({ from: '/_authed/s/$spaceId/investments/$id/sharing' })
  const toast = useToast()
  const investment = useInvestment(space.id, id)
  const sharedIn = investment.data ? isSharedIn(investment.data) : false
  const participants = useParticipants(space.id, id, Boolean(investment.data) && !sharedIn)
  const save = useSetParticipants(id)
  const [rows, setRows] = useState<ShareRow[] | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  // Seed the editor once, from what the server has.
  useEffect(() => {
    if (rows !== null || !participants.data) return
    const active = participants.data.filter(
      (p) => p.status !== 'REMOVED' && p.status !== 'DECLINED',
    )
    setRows(
      active.length
        ? active.map((p) => ({
            key: key(),
            isOwner: p.role === 'OWNER',
            displayName: p.displayName ?? '',
            email: p.email ?? '',
            sharePct: p.sharePct ?? '0',
          }))
        : [{ key: key(), isOwner: true, displayName: 'Me', email: '', sharePct: '100' }],
    )
  }, [participants.data, rows])

  if (investment.isPending || (participants.isPending && !sharedIn))
    return <Skeleton className="mx-auto h-64 max-w-2xl" />
  if (sharedIn) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          title="Only the owner can change sharing"
          description="This investment is shared with you, so it is read-only."
        />
      </div>
    )
  }
  if (investment.isError || participants.isError || !rows) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          title="Couldn't load sharing"
          description={participants.isError ? errorMessage(participants.error) : undefined}
          action={<Button onClick={() => void participants.refetch()}>Try again</Button>}
        />
      </div>
    )
  }

  const total = shareTotal(rows)
  const problem = shareProblem(rows)
  const exact = total.equals(100)
  const update = (k: string, patch: Partial<ShareRow>) =>
    setRows(rows.map((r) => (r.key === k ? { ...r, ...patch } : r)))

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageHeader title="Share" />
      <p className="-mt-3 text-sm text-label-secondary">
        Add people who share this investment, with their percentages. Someone with an account gets
        an invitation; a name-only entry is counted right away.
      </p>

      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.key}>
            <Card className="flex flex-col gap-3">
              <div className="grid grid-cols-[1fr_6rem] gap-3">
                <Field label={r.isOwner ? 'You' : 'Name'}>
                  <Input
                    value={r.displayName}
                    disabled={r.isOwner}
                    onChange={(e) => update(r.key, { displayName: e.target.value })}
                  />
                </Field>
                <Field label="Share %">
                  <Input
                    inputMode="decimal"
                    value={r.sharePct}
                    aria-label={`${r.displayName || 'Participant'} share percent`}
                    onChange={(e) => update(r.key, { sharePct: e.target.value })}
                  />
                </Field>
              </div>
              {r.isOwner ? null : (
                <>
                  <Field
                    label="Email (optional)"
                    hint="Adds an invitation to someone with an account"
                  >
                    <Input
                      type="email"
                      value={r.email}
                      onChange={(e) => update(r.key, { email: e.target.value })}
                    />
                  </Field>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-end text-negative"
                    onClick={() => setRows(rows.filter((x) => x.key !== r.key))}
                  >
                    <Trash2 aria-hidden className="size-4" /> Remove
                  </Button>
                </>
              )}
            </Card>
          </li>
        ))}
      </ul>

      <Button
        variant="secondary"
        disabled={rows.length >= MAX_PARTICIPANTS}
        onClick={() =>
          setRows([
            ...rows,
            { key: key(), isOwner: false, displayName: '', email: '', sharePct: '' },
          ])
        }
      >
        <Plus aria-hidden className="size-4" /> Add person
      </Button>

      <div
        className="sticky bottom-24 flex flex-col gap-2 rounded-lg border border-border bg-surface-1 p-4"
        data-testid="share-total"
      >
        <p className="flex justify-between font-semibold">
          <span>Total</span>
          <span className={cn('tabular', exact ? 'text-positive' : 'text-negative')}>
            {total.toFixed(2)}%
          </span>
        </p>
        {problem ? (
          <p role="status" className="text-sm text-label-secondary">
            {problem}
          </p>
        ) : null}
        {serverError ? (
          <p role="alert" className="text-sm text-negative">
            {serverError}
          </p>
        ) : null}
        <Button
          disabled={problem !== null || save.isPending}
          onClick={() => {
            setServerError(null)
            save.mutate(toParticipantsBody(rows), {
              onSuccess: () => toast.show('Sharing saved', 'success'),
              onError: (e) =>
                setServerError(
                  toAppError(e).code === 'VALIDATION_FAILED'
                    ? 'Check the highlighted fields.'
                    : errorMessage(e),
                ),
            })
          }}
        >
          {save.isPending ? 'Saving…' : 'Save sharing'}
        </Button>
      </div>
    </div>
  )
}
