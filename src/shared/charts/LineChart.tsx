import { format as formatDate, parseISO } from 'date-fns'
import { signOf, toDecimal } from '@/shared/money'
import { useInView } from '@/shared/motion/useInView'
import { Amount } from '@/shared/ui/Amount'
import { cn } from '@/shared/ui/cn'
import { type LinePoint, lineGeometry } from './geometry'
import { ChartTooltip, useInspect } from './inspect'
import { useChartWidth } from './useChartWidth'

interface LineChartProps {
  data: readonly LinePoint[]
  currency: string
  /** Names the chart for assistive technology. */
  label: string
  height?: number
  /** Override the colour trend; defaults to sign(last - first). */
  trend?: Trend
  /** Draw the line left to right, then fade the area in. Redraws when the series changes. */
  draw?: boolean
  /** Show a chart-shaped skeleton instead of the plot (no data yet). */
  loading?: boolean
}

export type Trend = 'up' | 'down' | 'flat'

/** Trend of a series: up green, down red, flat neutral. */
export function trendOf(data: readonly LinePoint[]): Trend {
  const first = data[0]
  const last = data[data.length - 1]
  if (!first || !last) return 'flat'
  const s = signOf(toDecimal(last.value).minus(toDecimal(first.value)))
  return s > 0 ? 'up' : s < 0 ? 'down' : 'flat'
}

const TREND_CLASS: Record<
  Trend,
  { stroke: string; fill: string; dot: string; halo: string; glow?: string }
> = {
  up: {
    stroke: 'stroke-up',
    fill: 'fill-up/15',
    dot: 'fill-up',
    halo: 'fill-up/25',
    glow: 'var(--glow-up)',
  },
  down: {
    stroke: 'stroke-down',
    fill: 'fill-down/15',
    dot: 'fill-down',
    halo: 'fill-down/25',
    glow: 'var(--glow-down)',
  },
  flat: {
    stroke: 'stroke-label-secondary',
    fill: 'fill-label-secondary/10',
    dot: 'fill-label-secondary',
    halo: 'fill-label-secondary/25',
  },
}

const SKELETON_BARS = [30, 38, 34, 46, 52, 48, 60, 66, 62, 74, 80, 78] as const
const MARGIN = { top: 12, right: 12, bottom: 24, left: 12 }
const fmtDay = (d: string) => formatDate(parseISO(`${d}T12:00:00`), 'd MMM')

/**
 * A net-worth style line: our own SVG, geometry from d3-scale and d3-shape, colours from tokens.
 * The live (today) point is marked. A single point renders as a dot, never an empty box.
 * No money is drawn inside the SVG (it would bypass hide-amounts); a hidden table carries the values.
 */
export function LineChart({
  data,
  currency,
  label,
  height = 160,
  trend,
  draw,
  loading,
}: LineChartProps) {
  const { ref, width } = useChartWidth()
  const [viewRef, seen] = useInView(Boolean(draw))
  const g = data.length > 0 ? lineGeometry(data, { width, height, margin: MARGIN }) : null
  const inspect = useInspect(g?.points.map((p) => p.x) ?? [])
  if (loading)
    return (
      <div
        ref={ref}
        aria-hidden
        data-testid="line-chart-skeleton"
        style={{ height }}
        className="flex w-full animate-pulse items-end gap-1 rounded-md bg-surface-3/40 p-3"
      >
        {SKELETON_BARS.map((h) => (
          <div key={h} className="flex-1 rounded-sm bg-surface-3" style={{ height: `${h}%` }} />
        ))}
      </div>
    )
  if (data.length === 0)
    return <p className="py-6 text-center text-sm text-label-secondary">No data for this period.</p>
  const t = TREND_CLASS[trend ?? trendOf(data)]
  if (!g) return null
  const active = inspect.index !== null ? g.points[inspect.index] : undefined
  const first = g.points[0]
  const last = g.points[g.points.length - 1]

  // A new key restarts the CSS animations, so changing the range redraws the line.
  const drawKey = draw ? `${data.length}:${first?.date}:${last?.date}` : 'static'
  return (
    <div ref={viewRef} data-inview={draw ? seen : undefined} className="w-full">
      <div ref={ref} className="w-full" data-testid="line-chart">
        <figure
          ref={inspect.boxRef as React.RefObject<HTMLElement>}
          aria-label={`${label}. Use the left and right arrow keys to inspect values.`}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: the chart is keyboard-inspectable
          tabIndex={0}
          style={{ touchAction: 'pan-y' }}
          className="relative rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent"
          {...inspect.handlers}
        >
          {active ? (
            <ChartTooltip x={active.x} width={width}>
              <p className="text-label-secondary">{fmtDay(active.date)}</p>
              <p className="font-medium">
                <Amount value={active.value} currency={currency} />
              </p>
            </ChartTooltip>
          ) : null}
          <svg
            key={drawKey}
            data-draw={draw || undefined}
            data-trend={trend ?? trendOf(data)}
            width={width}
            height={height}
            role="img"
            aria-label={label}
            className="block overflow-visible"
          >
            <title>{label}</title>
            {g.single ? (
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={first?.y}
                y2={first?.y}
                className="stroke-border-strong"
                strokeDasharray="4 4"
              />
            ) : (
              <>
                <path d={g.areaPath} className={cn(t.fill, draw && 'chart-area-in')} />
                <path
                  d={g.path}
                  // pathLength=1 lets the dash animation run 1 to 0 without measuring the path.
                  pathLength={1}
                  fill="none"
                  strokeWidth={2}
                  strokeLinecap="round"
                  className={cn(t.stroke, draw && 'chart-line-draw')}
                  style={t.glow ? { filter: `drop-shadow(${t.glow})` } : undefined}
                />
              </>
            )}
            {active && !g.single ? (
              <>
                <line
                  data-testid="chart-guide"
                  x1={active.x}
                  x2={active.x}
                  y1={MARGIN.top}
                  y2={height - MARGIN.bottom}
                  className="stroke-border-strong"
                />
                <circle cx={active.x} cy={active.y} r={4} className={t.dot} />
              </>
            ) : null}
            {g.points.map((p) =>
              p.live || g.single ? (
                <g
                  key={p.date}
                  data-live={p.live || undefined}
                  className={draw ? 'chart-dot-in' : undefined}
                >
                  <circle cx={p.x} cy={p.y} r={8} className={t.halo} />
                  <circle cx={p.x} cy={p.y} r={4} className={t.dot} />
                </g>
              ) : null,
            )}
            {first ? (
              <text
                x={first.x}
                y={height - 6}
                textAnchor={g.single ? 'middle' : 'start'}
                className="fill-label-secondary text-[11px]"
              >
                {fmtDay(first.date)}
              </text>
            ) : null}
            {last && !g.single ? (
              <text
                x={last.x}
                y={height - 6}
                textAnchor="end"
                className="fill-label-secondary text-[11px]"
              >
                {last.live ? 'Today' : fmtDay(last.date)}
              </text>
            ) : null}
          </svg>
        </figure>
        <p aria-live="polite" className="sr-only" data-testid="chart-readout">
          {active ? (
            <>
              {fmtDay(active.date)}: <Amount value={active.value} currency={currency} />
            </>
          ) : null}
        </p>
        {/* The wrapper clips it: a bare sr-only table ignores width:1px and widens the page. */}
        <div className="sr-only">
          <table>
            <caption>{label}</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Net worth</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.date}>
                  <th scope="row">{fmtDay(p.date)}</th>
                  <td>
                    <Amount value={p.value} currency={currency} />
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
