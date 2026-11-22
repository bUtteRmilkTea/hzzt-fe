import { Link, useNavigate } from '@tanstack/react-router'
import { format, getISODay, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Target } from 'lucide-react'
import { useState } from 'react'
import { useSpace } from '@/app/providers/SpaceProvider'
import { useGoals } from '@/features/goals/hooks'
import { useNetWorthHistory, useNetWorthSummary } from '@/shared/api/networth'
import { BarChart, DonutChart, LineChart } from '@/shared/charts'
import { useGrow } from '@/shared/motion/useGrow'
import { type Period, periodToSearch } from '@/shared/period'
import { Amount } from '@/shared/ui/Amount'
import { Button } from '@/shared/ui/Button'
import { cardClass } from '@/shared/ui/Card'
import { cn } from '@/shared/ui/cn'
import { EmptyState } from '@/shared/ui/EmptyState'
import { useLayout } from '@/shared/ui/layout'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { Skeleton } from '@/shared/ui/Skeleton'
import { StatCard } from '@/shared/ui/StatCard'
import { WarningsStrip } from '@/shared/ui/WarningsStrip'
import { type BreakdownType, useAnalytics, useBreakdown, useCalendar, useOverview } from './hooks'
import { RANGES, type Range, shiftMonth } from './search'

const Card = ({
  title,
  children,
  action,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) => (
  <section aria-label={title} className={cn(cardClass, 'flex flex-col gap-3 lg:gap-4')}>
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-medium">{title}</h2>
      {action}
    </div>
    {children}
  </section>
)

const Retry = ({ what, onRetry }: { what: string; onRetry: () => void }) => (
  <EmptyState
    title={`Couldn't load ${what}`}
    action={<Button onClick={onRetry}>Try again</Button>}
  />
)

/** A signed change, or a dash when the previous value was 0 (never a made-up 0%). */
export function ChangeText({ pct }: { pct: string | null }) {
  if (pct === null) {
    return (
      <span>
        <span aria-hidden>—</span>
        <span className="sr-only">No previous data to compare</span>
      </span>
    )
  }
  const neg = pct.startsWith('-')
  return (
    <span className="tabular">
      {neg ? '' : '+'}
      {pct}%
    </span>
  )
}

// ---- overview ----------------------------------------------------------------

export function OverviewCard({ period }: { period: Period }) {
  const { space } = useSpace()
  const q = useOverview(space.id, period)
  if (q.isPending) return <Skeleton className="h-28" />
  if (q.isError) return <Retry what="your overview" onRetry={() => void q.refetch()} />
  const o = q.data
  return (
    <div className="flex flex-col gap-3" data-testid="overview">
      {/* One column where the cell would be narrower than "IDR 5,000,000" (phones, and the 4/12 desktop rail). */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <StatCard
          label="Expenses"
          value={<Amount animate value={o.expense} currency={o.currency || space.baseCurrency} />}
          note={
            <span data-testid="expense-change">
              <ChangeText pct={o.change.expensePct} /> vs previous
            </span>
          }
        />
        <StatCard
          label="Income"
          value={<Amount animate value={o.income} currency={o.currency || space.baseCurrency} />}
          note={
            <span data-testid="income-change">
              <ChangeText pct={o.change.incomePct} /> vs previous
            </span>
          }
        />
      </div>
      <WarningsStrip warnings={o.warnings} />
    </div>
  )
}

// ---- net worth ---------------------------------------------------------------

export function NetWorthCard({ range, onRange }: { range: Range; onRange: (r: Range) => void }) {
  const { space } = useSpace()
  const { isWide } = useLayout()
  const summary = useNetWorthSummary(space.id)
  const history = useNetWorthHistory(space.id, range)
  const change = history.data?.changePct
  return (
    <Card title={space.trackingMode === 'CASH_ONLY' ? 'Cash' : 'Net worth'}>
      {summary.isPending ? (
        <Skeleton className="h-9 w-48" />
      ) : summary.isSuccess ? (
        <div className="flex flex-wrap items-baseline gap-3">
          <Amount
            value={summary.data.netWorth}
            currency={summary.data.currency || space.baseCurrency}
            className="text-3xl font-medium lg:text-4xl"
            animate
          />
          {change !== null && change !== undefined ? (
            <span
              data-testid="nw-change"
              className={cn(
                'tabular text-sm font-medium',
                change.startsWith('-') ? 'text-negative' : 'text-positive',
              )}
            >
              {change.startsWith('-') ? '' : '+'}
              {change}%
            </span>
          ) : null}
        </div>
      ) : null}
      <SegmentedControl
        aria-label="Net worth range"
        value={range}
        onValueChange={onRange}
        options={RANGES.map((r) => ({ value: r, label: r === 'ALL' ? 'All' : r }))}
      />
      {history.isPending ? (
        <LineChart
          loading
          height={isWide ? 240 : 160}
          data={[]}
          currency={space.baseCurrency}
          label="Net worth loading"
        />
      ) : history.isError ? (
        <Retry what="the chart" onRetry={() => void history.refetch()} />
      ) : (
        <LineChart
          data={history.data.points.map((p) => ({ date: p.date, value: p.netWorth, live: p.live }))}
          currency={history.data.currency || space.baseCurrency}
          label={`Net worth over ${range === 'ALL' ? 'all time' : `the last ${range}`}`}
          height={isWide ? 240 : 160}
          draw
        />
      )}
    </Card>
  )
}

// ---- category breakdown --------------------------------------------------------

export function BreakdownCard({ period }: { period: Period }) {
  const { space } = useSpace()
  const navigate = useNavigate()
  const [type, setType] = useState<BreakdownType>('EXPENSE')
  const q = useBreakdown(space.id, period, type)
  return (
    <Card title="Categories">
      <SegmentedControl
        aria-label="Breakdown type"
        value={type}
        onValueChange={setType}
        options={[
          { value: 'EXPENSE', label: 'Expense' },
          { value: 'INCOME', label: 'Income' },
        ]}
      />
      {q.isPending ? (
        <Skeleton className="h-52" />
      ) : q.isError ? (
        <Retry what="the breakdown" onRetry={() => void q.refetch()} />
      ) : (
        <>
          <WarningsStrip warnings={q.data.warnings} />
          <DonutChart
            label={`${type === 'EXPENSE' ? 'Expenses' : 'Income'} by category`}
            draw
            currency={q.data.currency || space.baseCurrency}
            centre={{
              value: String(q.data.items.reduce((n, i) => n + i.count, 0)),
              caption: 'transactions',
            }}
            slices={q.data.items.map((i) => ({
              key: i.key,
              amount: i.amount,
              name: i.name,
              icon: i.icon,
              color: i.color ?? 'var(--label-tertiary)',
              pct: i.pct,
              count: i.count,
              // Uncategorised has no category to filter by, so it is shown but not tappable.
              interactive: i.categoryId !== null,
            }))}
            onSelect={(key) => {
              const item = q.data.items.find((i) => i.key === key)
              if (!item?.categoryId) return
              void navigate({
                to: '/s/$spaceId/history',
                params: { spaceId: space.id },
                search: { ...periodToSearch(period), categoryIds: [item.categoryId] },
              })
            }}
          />
        </>
      )}
    </Card>
  )
}

// ---- analytics ---------------------------------------------------------------

export function AnalyticsCard({ period }: { period: Period }) {
  const { space } = useSpace()
  const q = useAnalytics(space.id, period)
  const overview = useOverview(space.id, period)
  return (
    <Card title="Analytics">
      {q.isPending ? (
        <Skeleton className="h-48" />
      ) : q.isError ? (
        <Retry what="analytics" onRetry={() => void q.refetch()} />
      ) : (
        <>
          <WarningsStrip warnings={q.data.warnings} />
          <BarChart
            groups={q.data.buckets}
            currency={q.data.currency || space.baseCurrency}
            label="Income and expenses over the period"
            draw
          />
          {overview.isSuccess ? (
            <dl
              className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-border pt-3 text-sm"
              data-testid="comparison"
            >
              <dt className="text-label-secondary">Income</dt>
              <dd>
                <Amount value={overview.data.income} currency={overview.data.currency} /> (
                <ChangeText pct={overview.data.change.incomePct} />)
              </dd>
              <dt className="text-label-secondary">Expenses</dt>
              <dd>
                <Amount value={overview.data.expense} currency={overview.data.currency} /> (
                <ChangeText pct={overview.data.change.expensePct} />)
              </dd>
              <dt className="text-label-secondary">Net</dt>
              <dd>
                <Amount
                  value={overview.data.net}
                  currency={overview.data.currency}
                  tone="auto"
                  signDisplay="always"
                />{' '}
                (<ChangeText pct={overview.data.change.netPct} />)
              </dd>
            </dl>
          ) : null}
        </>
      )}
    </Card>
  )
}

// ---- calendar ----------------------------------------------------------------

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function CalendarCard({ month, onMonth }: { month: string; onMonth: (m: string) => void }) {
  const { space } = useSpace()
  const q = useCalendar(space.id, month)
  const today = format(new Date(), 'yyyy-MM-dd')
  const first = parseISO(`${month}-01T12:00:00`)
  const blanks = getISODay(first) - 1 // Monday-first grid

  return (
    <Card
      title={format(first, 'MMMM yyyy')}
      action={
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous month"
            onClick={() => onMonth(shiftMonth(month, -1))}
          >
            <ChevronLeft aria-hidden className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next month"
            onClick={() => onMonth(shiftMonth(month, 1))}
          >
            <ChevronRight aria-hidden className="size-5" />
          </Button>
        </div>
      }
    >
      {q.isPending ? (
        <Skeleton className="h-60" />
      ) : q.isError ? (
        <Retry what="the calendar" onRetry={() => void q.refetch()} />
      ) : (
        <>
          <WarningsStrip warnings={q.data.warnings} />
          <div
            aria-hidden
            className="grid grid-cols-7 gap-1 text-center text-xs text-label-secondary"
          >
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <ul
            aria-label={`Activity in ${format(first, 'MMMM yyyy')}`}
            className="grid list-none grid-cols-7 gap-1 text-center"
          >
            {Array.from({ length: blanks }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: leading blank cells are positional
              <li key={`b${i}`} aria-hidden />
            ))}
            {q.data.days.map((d) => {
              const isToday = d.date === today
              const hasNet = d.net !== '0'
              return (
                <li key={d.date}>
                  <Link
                    to="/s/$spaceId/history"
                    params={{ spaceId: space.id }}
                    search={{ from: d.date, to: d.date }}
                    aria-label={`${format(parseISO(`${d.date}T12:00:00`), 'd MMMM')}, ${d.count} transactions`}
                    aria-current={isToday ? 'date' : undefined}
                    className={cn(
                      'flex min-h-14 flex-col items-center justify-start gap-0.5 rounded-md py-1 text-xs hover:bg-surface-3',
                      isToday && 'bg-accent/15 ring-1 ring-accent',
                    )}
                  >
                    <span className={cn('font-medium', isToday && 'text-accent')}>
                      {Number(d.date.slice(8))}
                    </span>
                    {hasNet ? (
                      <Amount
                        value={d.net}
                        currency={q.data.currency || space.baseCurrency}
                        tone="auto"
                        signDisplay="exceptZero"
                        compact
                        className="text-[10px] leading-tight"
                      />
                    ) : null}
                    {d.count > 0 ? (
                      <span
                        aria-hidden
                        className="size-1.5 rounded-full bg-label-tertiary"
                        data-testid="count-dot"
                      />
                    ) : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Card>
  )
}

// ---- goals ---------------------------------------------------------------------

/** A thin progress bar that grows from empty the first time it is seen. */
function GoalBar({ pct, achieved }: { pct: string | undefined; achieved: boolean }) {
  const n = Math.min(100, Math.max(0, Number(pct) || 0))
  const [ref, grown] = useGrow(n)
  return (
    <div
      ref={ref}
      role="progressbar"
      aria-label="Goal progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={n}
      className="h-2 overflow-hidden rounded-full bg-surface-3"
    >
      <div
        style={{ width: `${grown}%` }}
        className={cn(
          'h-full rounded-full transition-[width] duration-700 ease-out',
          achieved ? 'bg-positive' : 'bg-accent',
        )}
      />
    </div>
  )
}

/** Goals shown on Home before "View more" appears. */
const HOME_GOALS = 3

/** Up to three active goals with progress, a "View more" button when there are more, or an empty state. */
export function GoalsCard() {
  const { space } = useSpace()
  const q = useGoals(space.id)
  if (q.isPending) return <Skeleton className="h-32" />
  if (q.isError) return <Retry what="your goals" onRetry={() => void q.refetch()} />
  const allActive = q.data.filter((g) => !g.achievedAt)
  const active = allActive.slice(0, HOME_GOALS)
  return (
    <Card title="Goals">
      {active.length === 0 ? (
        <div className="flex flex-col items-start gap-3" data-testid="goals-empty">
          <p className="text-sm text-label-secondary">Set a target and watch your progress here.</p>
          <Button size="sm" asChild>
            <Link to="/s/$spaceId/goals/new" params={{ spaceId: space.id }}>
              Add goal
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-4" data-testid="goals-list">
          {active.map((g) => (
            <li key={g.id}>
              <Link
                to="/s/$spaceId/goals/$id"
                params={{ spaceId: space.id, id: g.id as string }}
                className="flex flex-col gap-1.5"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 font-medium">
                    <Target aria-hidden className="size-4 shrink-0 text-accent" />
                    <span className="truncate">
                      {g.icon} {g.name}
                    </span>
                  </span>
                  <span className="tabular text-sm text-label-secondary">
                    {Math.round(Number(g.progressPct) || 0)}%
                  </span>
                </span>
                <GoalBar pct={g.progressPct} achieved={false} />
                <span className="text-sm text-label-secondary">
                  <Amount value={g.progress ?? '0'} currency={g.currency ?? ''} /> of{' '}
                  <Amount value={g.targetAmount ?? '0'} currency={g.currency ?? ''} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {allActive.length > HOME_GOALS ? (
        <Button variant="secondary" block asChild>
          <Link to="/s/$spaceId/goals" params={{ spaceId: space.id }}>
            View more
          </Link>
        </Button>
      ) : null}
    </Card>
  )
}
