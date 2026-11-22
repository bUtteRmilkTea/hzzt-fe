import { useSpace } from '@/app/providers/SpaceProvider'
import { useBreakdown, useOverview } from '@/features/dashboard/hooks'
import { DonutChart } from '@/shared/charts'
import type { Period } from '@/shared/period'
import { periodLabel } from '@/shared/period/format'
import { Amount } from '@/shared/ui/Amount'
import { Skeleton } from '@/shared/ui/Skeleton'

/**
 * Sticky summary beside the list from 1280px: in and out for the period and where the spending
 * went. Every figure is server-computed (dashboard overview and category breakdown). They follow
 * the period only, not the category or wallet filters, and the heading says so.
 */
export function HistorySummaryRail({ period }: { period: Period }) {
  const { space } = useSpace()
  const overview = useOverview(space.id, period)
  const breakdown = useBreakdown(space.id, period, 'EXPENSE')
  const currency = overview.data?.currency || space.baseCurrency

  return (
    <aside
      aria-label="Period summary"
      data-testid="history-rail"
      className="sticky top-4 hidden w-72 shrink-0 flex-col gap-4 self-start rounded-lg border border-border bg-surface-1 p-4 xl:flex"
    >
      <div>
        <h2 className="text-base font-semibold">{periodLabel(period)}</h2>
        <p className="text-xs text-label-secondary">Totals for the period, before filters</p>
      </div>
      {overview.isPending ? (
        <Skeleton className="h-16" />
      ) : overview.isSuccess ? (
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-sm text-label-secondary">In</dt>
            <dd className="font-semibold">
              <Amount value={overview.data.income} currency={currency} tone="auto" />
            </dd>
          </div>
          <div>
            <dt className="text-sm text-label-secondary">Out</dt>
            <dd className="font-semibold">
              <Amount value={overview.data.expense} currency={currency} tone="expense" />
            </dd>
          </div>
        </dl>
      ) : null}
      {breakdown.isPending ? (
        <Skeleton className="h-44" />
      ) : breakdown.isSuccess && breakdown.data.items.length > 0 ? (
        <DonutChart
          draw
          size={160}
          label="Spending by category"
          currency={breakdown.data.currency || currency}
          centre={{
            value: String(breakdown.data.items.reduce((n, i) => n + i.count, 0)),
            caption: 'transactions',
          }}
          slices={breakdown.data.items.map((i) => ({
            key: i.key,
            amount: i.amount,
            name: i.name,
            icon: i.icon,
            color: i.color ?? 'var(--label-tertiary)',
            pct: i.pct,
            count: i.count,
            interactive: false,
          }))}
        />
      ) : null}
    </aside>
  )
}
