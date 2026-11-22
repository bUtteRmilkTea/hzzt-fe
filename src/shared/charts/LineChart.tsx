import { format as formatDate, parseISO } from 'date-fns'
import { signOf, toDecimal } from '@/shared/money'
import { Amount } from '@/shared/ui/Amount'
import { type LinePoint, lineGeometry } from './geometry'
import { useChartWidth } from './useChartWidth'

interface LineChartProps {
  data: readonly LinePoint[]
  currency: string
  /** Names the chart for assistive technology. */
  label: string
  height?: number
  /** Override the colour trend; defaults to sign(last - first). */
  trend?: Trend
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

const MARGIN = { top: 12, right: 12, bottom: 24, left: 12 }
const fmtDay = (d: string) => formatDate(parseISO(`${d}T12:00:00`), 'd MMM')

/**
 * A net-worth style line: our own SVG, geometry from d3-scale and d3-shape, colours from tokens.
 * The live (today) point is marked. A single point renders as a dot, never an empty box.
 * No money is drawn inside the SVG (it would bypass hide-amounts); a hidden table carries the values.
 */
export function LineChart({ data, currency, label, height = 160, trend }: LineChartProps) {
  const { ref, width } = useChartWidth()
  if (data.length === 0)
    return <p className="py-6 text-center text-sm text-label-secondary">No data for this period.</p>
  const t = TREND_CLASS[trend ?? trendOf(data)]
  const g = lineGeometry(data, { width, height, margin: MARGIN })
  const first = g.points[0]
  const last = g.points[g.points.length - 1]

  return (
    <div ref={ref} className="w-full" data-testid="line-chart">
      <svg
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
            <path d={g.areaPath} className={t.fill} />
            <path
              d={g.path}
              fill="none"
              strokeWidth={2}
              strokeLinecap="round"
              className={t.stroke}
              style={t.glow ? { filter: `drop-shadow(${t.glow})` } : undefined}
            />
          </>
        )}
        {g.points.map((p) =>
          p.live || g.single ? (
            <g key={p.date} data-live={p.live || undefined}>
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
      <table className="sr-only">
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
  )
}
