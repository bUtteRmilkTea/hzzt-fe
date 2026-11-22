import { useNavigate, useParams } from '@tanstack/react-router'
import { TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useSpace } from '@/app/providers/SpaceProvider'
import { errorMessage } from '@/shared/api/errors'
import { useWallets, type WalletDTO } from '@/shared/api/wallets'
import { Decimal, parseInput } from '@/shared/money'
import { Amount } from '@/shared/ui/Amount'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { PageHeader } from '@/shared/ui/PageHeader'
import { ProgressRing } from '@/shared/ui/ProgressRing'
import { Skeleton } from '@/shared/ui/Skeleton'
import { useToast } from '@/shared/ui/Toast'
import { WarningsStrip } from '@/shared/ui/WarningsStrip'
import { pctLabel } from './GoalsScreen'
import { type GoalDTO, useDeleteGoal, useGoal, useSetAllocation } from './hooks'
import { availableAfter, reserveProblem } from './reserve'

function AllocationRow({
  wallet,
  goal,
  spaceId,
}: {
  wallet: WalletDTO
  goal: GoalDTO
  spaceId: string
}) {
  const toast = useToast()
  const set = useSetAllocation(spaceId, goal.id as string)
  const current = goal.allocations?.find((a) => a.walletId === wallet.id)?.amount ?? '0'
  const [value, setValue] = useState(current === '0' ? '' : current)
  const [serverError, setServerError] = useState<string | null>(null)
  const currency = wallet.currency ?? ''
  const normalised = value === '' ? '0' : (parseInput(value, currency) ?? value)
  // Compare as numbers: "100" and "100.00" are the same reservation.
  const unchanged = new Decimal(normalised).equals(current)
  // An untouched reservation is never an error, even if spending has left the wallet over-reserved.
  const problem = unchanged ? null : reserveProblem(normalised, wallet.available ?? '0', current)

  return (
    <li>
      <Card className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate font-medium">
            <span aria-hidden>{wallet.icon}</span> {wallet.name}
          </p>
          <p className="text-sm text-label-secondary">
            Available <Amount value={wallet.available ?? '0'} currency={currency} />
          </p>
        </div>
        {/* Over-reserved is a warning, never an error: expenses can push a wallet below its reserves. */}
        {wallet.overReserved ? (
          <p role="status" className="flex items-center gap-2 text-sm text-warning">
            <TriangleAlert aria-hidden className="size-4" /> This wallet has less than is reserved
            in it.
          </p>
        ) : null}
        <Field
          label={`Reserved for this goal (${currency})`}
          error={problem ?? serverError ?? undefined}
          hint={
            !problem && value !== ''
              ? `Left available: ${availableAfter(wallet.available ?? '0', current, normalised)}`
              : undefined
          }
        >
          <Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
        <Button
          size="sm"
          variant="secondary"
          className="self-end"
          disabled={Boolean(problem) || unchanged || set.isPending}
          onClick={() => {
            setServerError(null)
            set.mutate(
              { walletId: wallet.id as string, amount: normalised },
              {
                onSuccess: () => toast.show('Reservation saved', 'success'),
                onError: (e) => setServerError(errorMessage(e)),
              },
            )
          }}
        >
          {set.isPending ? 'Saving…' : 'Save'}
        </Button>
      </Card>
    </li>
  )
}

export function GoalDetailScreen() {
  const { space } = useSpace()
  const { id } = useParams({ from: '/_authed/s/$spaceId/goals/$id' })
  const navigate = useNavigate()
  const toast = useToast()
  const goal = useGoal(space.id, id)
  const wallets = useWallets(space.id)
  const remove = useDeleteGoal(space.id, id)
  const [confirm, setConfirm] = useState(false)

  if (goal.isPending) return <Skeleton className="mx-auto h-64 max-w-4xl" />
  if (goal.isError || !goal.data) {
    return (
      <div className="mx-auto max-w-4xl">
        <EmptyState
          title="Couldn't load this goal"
          action={<Button onClick={() => void goal.refetch()}>Try again</Button>}
        />
      </div>
    )
  }
  const g = goal.data
  const achieved = Boolean(g.achievedAt)
  const currency = g.currency ?? ''
  const over = (g.allocations ?? []).some(
    (a) => wallets.data?.items.find((w) => w.id === a.walletId)?.overReserved,
  )

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <PageHeader title={g.name ?? 'Goal'} />
      <Card className="flex items-center gap-5" data-testid="goal-summary">
        <ProgressRing
          pct={g.progressPct}
          size={88}
          stroke={8}
          label={pctLabel(g.progressPct)}
          achieved={achieved}
        />
        <div className="flex flex-col gap-0.5">
          {achieved ? <p className="font-semibold text-positive">Goal achieved</p> : null}
          <p className="text-xl font-semibold">
            <Amount value={g.progress ?? '0'} currency={currency} />
          </p>
          <p className="text-sm text-label-secondary">
            of <Amount value={g.targetAmount ?? '0'} currency={currency} />
          </p>
          {!achieved && g.remaining ? (
            <p className="text-sm text-label-secondary">
              <Amount value={g.remaining} currency={currency} /> to go
              {g.requiredMonthly ? (
                <>
                  {' · '}
                  <Amount value={g.requiredMonthly} currency={currency} /> a month
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      </Card>
      <WarningsStrip warnings={g.warnings} />
      {over ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-md border border-warning px-4 py-3 text-sm"
        >
          <TriangleAlert aria-hidden className="size-4 text-warning" /> One of the wallets behind
          this goal has less money than is reserved.
        </p>
      ) : null}

      <section aria-labelledby="alloc" className="flex flex-col gap-3">
        <h2 id="alloc" className="text-lg font-semibold">
          Reserved in wallets
        </h2>
        {wallets.isPending ? (
          <Skeleton className="h-24" />
        ) : (wallets.data?.items ?? []).length === 0 ? (
          <p className="text-sm text-label-secondary">
            Add a wallet to reserve money for this goal.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {(wallets.data?.items ?? []).map((w) => (
              <AllocationRow key={`${w.id}-${g.progress}`} wallet={w} goal={g} spaceId={space.id} />
            ))}
          </ul>
        )}
      </section>

      <Button variant="ghost" className="text-negative" onClick={() => setConfirm(true)}>
        Delete goal
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${g.name}?`}
        description="Its reservations are released. No money moves."
        confirmLabel="Delete goal"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => {
              toast.show('Goal deleted', 'success')
              void navigate({ to: '/s/$spaceId/goals', params: { spaceId: space.id } })
            },
            onError: (e) => {
              setConfirm(false)
              toast.show(errorMessage(e), 'error')
            },
          })
        }
      />
    </div>
  )
}
