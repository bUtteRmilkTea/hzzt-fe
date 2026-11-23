import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react'
import { useState } from 'react'
import { useSpace } from '@/app/providers/SpaceProvider'
import { coverage as spanOf } from '@/features/investments/portfolioHistory'
import { type HistoryRange, type SeriesKey, useNetWorthHistory } from '@/shared/api/networth'
import { LineChart } from '@/shared/charts'
import { Amount } from '@/shared/ui/Amount'
import { cn } from '@/shared/ui/cn'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { Skeleton } from '@/shared/ui/Skeleton'
import {
  directionSentence,
  GROWTH_RANGES,
  SERIES,
  seriesPoints,
  trendFromDirection,
} from './growth'

const signed = (v: string) => (v.startsWith('-') ? v : `+${v}`)

/**
 * Are the investments and the assets rising or falling over a chosen range? One response holds all
 * the lines, so switching the series never refetches; a new range does. Every figure and the
 * direction come from the server.
 */
export function GrowthChart({
  defaultSeries = 'netWorth',
  currency,
  testId = 'growth-chart',
  label,
  allow,
}: {
  defaultSeries?: SeriesKey
  currency: string
  testId?: string
  label?: string
  /** Limit the series offered, such as net worth only for a cash-only space. */
  allow?: readonly SeriesKey[]
}) {
  const { space } = useSpace()
  const [series, setSeries] = useState<SeriesKey>(defaultSeries)
  const [range, setRange] = useState<HistoryRange>('1M')
  const history = useNetWorthHistory(space.id, range)
  const h = history.data
  const v = h?.series?.[series] ?? null
  const options = allow ? SERIES.filter((o) => allow.includes(o.value)) : SERIES
  const seriesLabel = SERIES.find((s) => s.value === series)?.label ?? ''
  const points = seriesPoints(h, series)
  const cur = h?.currency || currency
  const trend = trendFromDirection(v?.direction ?? null)
  const sentence = directionSentence(v?.direction ?? null, range)
  const rangeLabel = GROWTH_RANGES.find((r) => r.value === range)?.label ?? range
  const contributions = v?.netContributions ?? null
  const hasContributions = contributions !== null && /[1-9]/.test(contributions)
  const today = new Date().toISOString().slice(0, 10)
  const span = spanOf(points, range, new Date(`${today}T00:00:00Z`))
  const Arrow =
    v?.direction === 'RISING' ? ArrowUp : v?.direction === 'FALLING' ? ArrowDown : ArrowRight
  const tone =
    v?.direction === 'RISING'
      ? 'text-positive'
      : v?.direction === 'FALLING'
        ? 'text-negative'
        : 'text-label-secondary'

  return (
    <section
      aria-label={label ?? 'Growth over time'}
      data-testid={testId}
      className="flex min-w-0 flex-col gap-3"
    >
      {options.length > 1 ? (
        <div className="-mx-1 overflow-x-auto px-1">
          <SegmentedControl
            aria-label="Series"
            value={series}
            onValueChange={setSeries}
            options={options}
            className="w-max min-w-full sm:min-w-0"
          />
        </div>
      ) : null}
      <div className="-mx-1 overflow-x-auto px-1">
        <SegmentedControl
          aria-label="Growth range"
          value={range}
          onValueChange={setRange}
          options={GROWTH_RANGES}
          className="w-max min-w-full sm:min-w-0"
        />
      </div>

      {history.isPending ? (
        <Skeleton className="h-28" />
      ) : (
        <div className="flex flex-col gap-1" data-testid="growth-summary">
          <p className="text-sm text-label-secondary">{seriesLabel}</p>
          <p className="text-2xl font-medium">
            {v?.last ? <Amount value={v.last} currency={cur} /> : <span>—</span>}
          </p>
          <p className={cn('flex flex-wrap items-center gap-x-2 text-sm font-medium', tone)}>
            <Arrow aria-hidden className="size-4" data-testid="growth-arrow" />
            <span data-testid="growth-change">
              {v?.change ? <Amount value={v.change} currency={cur} signDisplay="always" /> : '—'} (
              {v?.changePct ? `${signed(v.changePct)}%` : '—'})
            </span>
          </p>
          <p className="text-sm text-label-secondary" data-testid="growth-performance">
            Return, excl. deposits: {v?.performancePct ? `${signed(v.performancePct)}%` : '—'}
          </p>
          {sentence ? (
            <p className="text-sm" data-testid="growth-sentence">
              {sentence}
            </p>
          ) : null}
        </div>
      )}

      {points.length > 1 || history.isPending ? (
        <LineChart
          draw
          loading={history.isPending}
          height={180}
          data={points}
          currency={cur}
          valueLabel={seriesLabel}
          {...(trend ? { trend } : {})}
          label={`${seriesLabel} over ${rangeLabel}`}
        />
      ) : (
        <p className="py-8 text-center text-sm text-label-secondary">History starts today.</p>
      )}

      {hasContributions && contributions && !history.isPending ? (
        <p role="note" data-testid="growth-contributions" className="text-xs text-label-secondary">
          {contributions.startsWith('-') ? (
            <>
              <Amount value={contributions.slice(1)} currency={cur} /> of your money in this range
              was taken out by you.
            </>
          ) : (
            <>
              <Amount value={contributions} currency={cur} /> of your money in this range was added
              by you.
            </>
          )}
        </p>
      ) : null}
      {h?.coverage?.short && !history.isPending ? (
        <p role="note" data-testid="growth-coverage" className="text-xs text-label-secondary">
          Your data only covers {span.spanLabel}.
        </p>
      ) : null}
    </section>
  )
}
