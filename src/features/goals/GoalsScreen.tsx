import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { Plus } from 'lucide-react'
import { useSpace } from '@/app/providers/SpaceProvider'
import { Amount } from '@/shared/ui/Amount'
import { Button } from '@/shared/ui/Button'
import { cardClass, cardInteractive } from '@/shared/ui/Card'
import { cn } from '@/shared/ui/cn'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Page } from '@/shared/ui/Page'
import { PageHeader } from '@/shared/ui/PageHeader'
import { ProgressRing } from '@/shared/ui/ProgressRing'
import { Skeleton } from '@/shared/ui/Skeleton'
import { STAGGER, staggerStyle } from '@/shared/ui/stagger'
import { WarningsStrip } from '@/shared/ui/WarningsStrip'
import { type GoalDTO, useGoals } from './hooks'

/** The ring label is the server's percentage, rounded for display only. */
export function pctLabel(pct: string | undefined): string {
  const n = Number(pct)
  return Number.isFinite(n) ? `${Math.round(n)}%` : '0%'
}

export function GoalCard({ goal: g, spaceId }: { goal: GoalDTO; spaceId: string }) {
  const achieved = Boolean(g.achievedAt)
  return (
    <Link
      to="/s/$spaceId/goals/$id"
      params={{ spaceId, id: g.id as string }}
      className={cn(cardClass, cardInteractive, 'flex items-center gap-4')}
    >
      <ProgressRing pct={g.progressPct} label={pctLabel(g.progressPct)} achieved={achieved} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate font-medium">
          <span aria-hidden>{g.icon}</span> {g.name}
          {achieved ? (
            <span className="rounded-full bg-positive/15 px-2 text-xs font-semibold text-positive">
              Achieved
            </span>
          ) : null}
        </p>
        <p className="text-sm text-label-secondary">
          <Amount animate value={g.progress ?? '0'} currency={g.currency ?? ''} /> of{' '}
          <Amount value={g.targetAmount ?? '0'} currency={g.currency ?? ''} />
        </p>
        <p className="text-sm text-label-secondary">
          {g.targetDate
            ? `By ${format(new Date(`${g.targetDate}T12:00:00`), 'd MMM yyyy')}`
            : 'No target date'}
          {g.requiredMonthly && !achieved ? (
            <>
              {' · '}
              <Amount value={g.requiredMonthly} currency={g.currency ?? ''} /> a month
            </>
          ) : null}
        </p>
      </div>
    </Link>
  )
}

export function GoalsScreen() {
  const { space } = useSpace()
  const goals = useGoals(space.id)
  return (
    <Page>
      <PageHeader
        title="Goals"
        backToSettings
        action={
          <Button size="sm" asChild>
            <Link to="/s/$spaceId/goals/new" params={{ spaceId: space.id }}>
              <Plus aria-hidden className="size-4" />
              Add goal
            </Link>
          </Button>
        }
      />
      {goals.isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : goals.isError ? (
        <EmptyState
          title="Couldn't load your goals"
          action={<Button onClick={() => void goals.refetch()}>Try again</Button>}
        />
      ) : goals.data.length === 0 ? (
        <EmptyState
          title="No goals yet"
          description="Set a target and earmark money in your wallets for it."
          action={
            <Button asChild>
              <Link to="/s/$spaceId/goals/new" params={{ spaceId: space.id }}>
                Add goal
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <WarningsStrip warnings={goals.data.flatMap((g) => g.warnings ?? [])} />
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6 xl:grid-cols-3 2xl:grid-cols-4">
            {goals.data.map((g, i) => (
              <li key={g.id} className={STAGGER} style={staggerStyle(i)}>
                <GoalCard goal={g} spaceId={space.id} />
              </li>
            ))}
          </ul>
        </>
      )}
    </Page>
  )
}
