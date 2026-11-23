import { type CSSProperties, useState } from 'react'
import { useInView } from '@/shared/motion/useInView'
import { Amount } from '@/shared/ui/Amount'
import { cn } from '@/shared/ui/cn'
import { type BarGroup, barGeometry } from './geometry'
import { ChartTooltip, useInspect } from './inspect'
import { useChartWidth } from './useChartWidth'

interface BarChartProps {
  groups: readonly BarGroup[]
  currency: string
  label: string
  height?: number
  /** Grow the bars up from the baseline, staggered. */
  draw?: boolean
}

const MARGIN = { top: 8, right: 8, bottom: 28, left: 8 }

/** Income and expense side by side per bucket. Bucket labels are drawn exactly as the server sent them. */
export function BarChart({ groups, currency, label, height = 180, draw }: BarChartProps) {
  const { ref, width } = useChartWidth()
  const [viewRef, seen] = useInView(Boolean(draw))
  const [shown, setShown] = useState({ income: true, expense: true })
  // A hidden series is zeroed, so the axis refits to what is left.
  const visible = groups.map((b) => ({
    label: b.label,
    income: shown.income ? b.income : '0',
    expense: shown.expense ? b.expense : '0',
  }))
  const geo = barGeometry(visible, { width, height, margin: MARGIN })
  const inspect = useInspect(geo.labels.map((l) => l.x))
  const empty = groups.length === 0 || groups.every((g) => g.income === '0' && g.expense === '0')
  if (empty)
    return (
      <p className="py-6 text-center text-sm text-label-secondary">
        No income or expenses in this period.
      </p>
    )
  const g = geo
  const active = inspect.index !== null ? groups[inspect.index] : undefined
  const dense = groups.length > 8

  return (
    <div ref={viewRef} data-inview={draw ? seen : undefined} className="w-full">
      <div ref={ref} className="w-full" data-testid="bar-chart">
        <figure
          ref={inspect.boxRef as React.RefObject<HTMLElement>}
          aria-label={`${label}. Use the left and right arrow keys to inspect a period.`}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: the chart is keyboard-inspectable
          tabIndex={0}
          style={{ touchAction: 'pan-y' }}
          className="relative rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent"
          {...inspect.handlers}
        >
          {active && inspect.index !== null ? (
            <ChartTooltip x={g.labels[inspect.index]?.x ?? 0} width={width}>
              <p className="text-label-secondary">{active.label}</p>
              {shown.income ? (
                <p>
                  Income{' '}
                  <Amount value={active.income} currency={currency} className="text-positive" />
                </p>
              ) : null}
              {shown.expense ? (
                <p>
                  Expense{' '}
                  <Amount value={active.expense} currency={currency} className="text-negative" />
                </p>
              ) : null}
            </ChartTooltip>
          ) : null}
          <svg width={width} height={height} role="img" aria-label={label} className="block">
            <title>{label}</title>
            <line
              x1={MARGIN.left}
              x2={width - MARGIN.right}
              y1={g.baseline}
              y2={g.baseline}
              className="stroke-border-strong"
            />
            {g.bars.map((b, i) => (
              <rect
                key={`${b.label}-${b.kind}`}
                data-kind={b.kind}
                style={draw ? ({ '--i': Math.floor(i / 2) } as CSSProperties) : undefined}
                x={b.x}
                y={b.y}
                width={Math.max(0, b.width)}
                height={b.height}
                rx={3}
                className={cn(
                  b.kind === 'income' ? 'fill-positive' : 'fill-negative',
                  draw && 'chart-bar',
                )}
              />
            ))}
            {g.labels.map((l) => (
              <text
                key={l.label}
                x={l.x}
                y={height - 8}
                textAnchor="middle"
                className={
                  dense ? 'fill-label-secondary text-[9px]' : 'fill-label-secondary text-[11px]'
                }
              >
                {l.label}
              </text>
            ))}
          </svg>
        </figure>
        {/* The legend names the two series, so colour is never the only cue. Each one toggles its bars. */}
        <ul className="mt-2 flex justify-center gap-4 text-sm text-label-secondary">
          {(['income', 'expense'] as const).map((k) => (
            <li key={k}>
              <button
                type="button"
                aria-pressed={shown[k]}
                onClick={() =>
                  // Keep at least one series on screen.
                  setShown((s) =>
                    s[k] && !s[k === 'income' ? 'expense' : 'income'] ? s : { ...s, [k]: !s[k] },
                  )
                }
                className={cn(
                  'flex min-h-12 items-center gap-2 px-2',
                  !shown[k] && 'line-through opacity-60',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'size-3 rounded-sm',
                    k === 'income' ? 'bg-positive' : 'bg-negative',
                  )}
                />
                {k === 'income' ? 'Income' : 'Expense'}
              </button>
            </li>
          ))}
        </ul>
        <p aria-live="polite" className="sr-only" data-testid="chart-readout">
          {active ? (
            <>
              {active.label}: income <Amount value={active.income} currency={currency} />, expense{' '}
              <Amount value={active.expense} currency={currency} />
            </>
          ) : null}
        </p>
        {/* The wrapper clips it: a bare sr-only table ignores width:1px and widens the page. */}
        <div className="sr-only">
          <table>
            <caption>{label}</caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col">Income</th>
                <th scope="col">Expense</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((b) => (
                <tr key={b.label}>
                  <th scope="row">{b.label}</th>
                  <td>
                    <Amount value={b.income} currency={currency} />
                  </td>
                  <td>
                    <Amount value={b.expense} currency={currency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
