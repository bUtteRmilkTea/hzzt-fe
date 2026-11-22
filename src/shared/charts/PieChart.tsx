import type { CSSProperties } from 'react'
import { Amount } from '@/shared/ui/Amount'
import { cn } from '@/shared/ui/cn'
import { donutGeometry } from './geometry'
import { allocatePct } from './pct'

export interface PieSlice {
  key: string
  name: string
  /** API money string; the size of the slice. */
  amount: string
  /** Server-computed share, e.g. "42.50". Computed locally (sums to 100.00) when omitted. */
  pct?: string | null
}

interface PieChartProps {
  slices: readonly PieSlice[]
  currency: string
  label: string
  size?: number
  /** Hide the legend (compact pies, e.g. inside a wrapper header). */
  compact?: boolean
  /** Show each slice's amount in the legend (default true). */
  showAmounts?: boolean
  selectedKey?: string | null
  onSelect?: (key: string) => void
  /** Cut a hole in the middle: a donut. */
  donut?: boolean
  /** `row` puts the legend to the right of the chart; the default stacks it below. */
  layout?: 'stack' | 'row'
  /** Sweep the slices in, staggered. */
  draw?: boolean
}

const RAMP = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
]

/**
 * Pie or donut with an accessible legend (index, name, percent, amount). Slice colours come from
 * the `--chart-*` token ramp; the index in the legend means colour is never the only cue. Only the
 * selected slice uses the up colour.
 */
export function PieChart({
  slices,
  currency,
  label,
  size = 160,
  compact,
  showAmounts = true,
  selectedKey,
  onSelect,
  donut,
  layout = 'stack',
  draw,
}: PieChartProps) {
  const pcts = allocatePct(slices.map((s) => s.amount))
  const pctOf = (i: number) => slices[i]?.pct ?? (pcts[i] as string)
  const r = size / 2 - 2
  const arcs = donutGeometry(slices, r, donut ? r * 0.6 : 0)
  const colorOf = (key: string) => {
    const i = slices.findIndex((s) => s.key === key)
    return RAMP[i % RAMP.length] as string
  }
  if (arcs.length === 0)
    return <p className="py-4 text-center text-sm text-label-secondary">Nothing to show yet.</p>

  return (
    <div
      className={cn(
        'flex gap-4',
        compact || layout === 'row' ? 'items-center' : 'flex-col items-center',
        layout === 'row' && 'flex-col sm:flex-row',
      )}
      data-testid="pie-chart"
    >
      <svg width={size} height={size} role="img" aria-label={label} className="block shrink-0">
        <title>{label}</title>
        <g transform={`translate(${size / 2},${size / 2})`}>
          {arcs.map((a, i) => (
            <path
              key={a.key}
              d={a.path}
              data-slice={a.key}
              aria-hidden
              style={{
                fill: selectedKey === a.key ? 'var(--up)' : colorOf(a.key),
                stroke: 'var(--bg)',
                strokeWidth: 1,
                ...(draw ? ({ '--i': i } as CSSProperties) : {}),
              }}
              onClick={onSelect ? () => onSelect(a.key) : undefined}
              className={cn(onSelect && 'cursor-pointer', draw && 'chart-slice')}
            />
          ))}
        </g>
      </svg>
      {compact ? null : (
        <ul
          className={cn('flex w-full flex-col gap-1', layout === 'row' && 'min-w-0 flex-1')}
          aria-label={`${label} legend`}
        >
          {slices.map((s, i) => {
            const body = (
              <>
                <span className="w-4 text-xs text-label-tertiary">{i + 1}</span>
                <span
                  aria-hidden
                  style={{ backgroundColor: RAMP[i % RAMP.length] }}
                  className="size-3 shrink-0 rounded-full border border-border-strong"
                />
                <span className="min-w-0 flex-1 truncate text-left">{s.name}</span>
                <span className="tabular text-label-secondary">{pctOf(i)}%</span>
                {showAmounts ? (
                  <Amount value={s.amount} currency={currency} className="w-28 text-right" />
                ) : null}
              </>
            )
            return (
              <li key={s.key}>
                {onSelect ? (
                  <button
                    type="button"
                    aria-pressed={selectedKey === s.key}
                    onClick={() => onSelect(s.key)}
                    className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 hover:bg-surface-3 aria-pressed:bg-surface-3"
                  >
                    {body}
                  </button>
                ) : (
                  <div className="flex min-h-10 w-full items-center gap-2 px-2">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
