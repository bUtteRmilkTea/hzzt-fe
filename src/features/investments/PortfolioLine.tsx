import { useState } from 'react'
import { useSpace } from '@/app/providers/SpaceProvider'
import { type HistoryRange, useNetWorthHistory } from '@/shared/api/networth'
import { LineChart } from '@/shared/charts'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { coverage, PORTFOLIO_RANGES } from './portfolioHistory'

/**
 * The portfolio value over time, with a range picker. The server returns what it has: a longer
 * range than the data just shows less, and a note says how much there is.
 */
export function PortfolioLine({ currency }: { currency: string }) {
  const { space } = useSpace()
  const [range, setRange] = useState<HistoryRange>('1M')
  const history = useNetWorthHistory(space.id, range)
  const points = (history.data?.points ?? []).map((p) => ({
    date: p.date,
    value: p.investments,
    live: p.live,
  }))
  const today = new Date().toISOString().slice(0, 10)
  const cov = coverage(points, range, new Date(`${today}T00:00:00Z`))
  const change = history.data?.investmentsChangePct
  return (
    <section
      aria-label="Portfolio over time"
      data-testid="portfolio-line"
      className="flex min-w-0 flex-col gap-3"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-1 overflow-x-auto px-1">
          <SegmentedControl
            aria-label="Portfolio range"
            value={range}
            onValueChange={setRange}
            options={PORTFOLIO_RANGES}
            className="w-max min-w-full sm:min-w-0"
          />
        </div>
        {change !== null && change !== undefined && points.length > 1 ? (
          <span
            data-testid="portfolio-change"
            className={`tabular text-sm font-medium ${change.startsWith('-') ? 'text-negative' : 'text-positive'}`}
          >
            {change.startsWith('-') ? '' : '+'}
            {change}%
          </span>
        ) : null}
      </div>
      {points.length > 1 || history.isPending ? (
        <LineChart
          draw
          loading={history.isPending}
          height={180}
          data={points}
          currency={history.data?.currency || currency}
          label={`Portfolio value, ${PORTFOLIO_RANGES.find((r) => r.value === range)?.label}`}
        />
      ) : (
        <p className="py-8 text-center text-sm text-label-secondary">History starts today.</p>
      )}
      {cov.short && !history.isPending ? (
        <p role="note" data-testid="portfolio-coverage" className="text-xs text-label-secondary">
          Your data only covers {cov.spanLabel}.
        </p>
      ) : null}
    </section>
  )
}
