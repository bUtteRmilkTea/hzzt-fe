import { scaleBand, scaleLinear, scaleTime } from 'd3-scale'
import { arc, area, curveMonotoneX, line, pie } from 'd3-shape'
import { toDecimal } from '@/shared/money'

/**
 * Plot position of a money string. Used for geometry ONLY (pixels), never for display, so the
 * loss of precision in a double cannot reach the user. Every figure shown still goes through <Amount>.
 */
export const plotValue = (v: string): number => toDecimal(v).toNumber()

export interface Box {
  width: number
  height: number
  /** Space reserved around the plot for labels. */
  margin: { top: number; right: number; bottom: number; left: number }
}

// ---- line chart ----------------------------------------------------------------

export interface LinePoint {
  /** `YYYY-MM-DD` */
  date: string
  value: string
  live?: boolean
}

export interface LineGeometry {
  path: string
  areaPath: string
  points: Array<{ x: number; y: number; date: string; value: string; live: boolean }>
  yMin: number
  yMax: number
  /** True when there is a single point: drawn as a dot with a baseline, never an empty box. */
  single: boolean
}

const dayMs = (d: string) => new Date(`${d}T12:00:00`).getTime()

/** Line and area paths plus point positions for a net worth series. */
export function lineGeometry(data: readonly LinePoint[], box: Box): LineGeometry {
  const innerW = Math.max(0, box.width - box.margin.left - box.margin.right)
  const innerH = Math.max(0, box.height - box.margin.top - box.margin.bottom)
  const values = data.map((d) => plotValue(d.value))
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  // Pad a flat series so it draws a visible mid-height line instead of collapsing onto an edge.
  const pad = hi === lo ? Math.max(1, Math.abs(hi) * 0.1) : (hi - lo) * 0.08
  // Fitted to the data with 8% padding. Non-negative data never gets a negative axis.
  const yMin = lo >= 0 ? Math.max(0, lo - pad) : lo - pad
  const yMax = hi + pad
  const y = scaleLinear().domain([yMin, yMax]).range([innerH, 0])
  const single = data.length === 1

  const first = data[0]
  const last = data[data.length - 1]
  const timeScale =
    first && last && !single
      ? scaleTime()
          .domain([dayMs(first.date), dayMs(last.date)])
          .range([0, innerW])
      : null
  const xOf = (date: string) => box.margin.left + (timeScale ? timeScale(dayMs(date)) : innerW / 2)

  const pts = data.map((d, i) => ({
    x: xOf(d.date),
    y: box.margin.top + y(values[i] as number),
    date: d.date,
    value: d.value,
    live: Boolean(d.live),
  }))

  const pairs = pts.map((p) => [p.x, p.y] as [number, number])
  const path = line().curve(curveMonotoneX)(pairs) ?? ''
  const areaPath =
    area<[number, number]>()
      .x((p) => p[0])
      .y0(box.margin.top + innerH)
      .y1((p) => p[1])
      .curve(curveMonotoneX)(pairs) ?? ''
  return { path, areaPath, points: pts, yMin, yMax, single }
}

// ---- bar chart -----------------------------------------------------------------

export interface BarGroup {
  label: string
  income: string
  expense: string
}

export interface BarGeometry {
  bars: Array<{
    label: string
    kind: 'income' | 'expense'
    x: number
    y: number
    width: number
    height: number
    value: string
  }>
  labels: Array<{ label: string; x: number }>
  max: number
  baseline: number
}

export function barGeometry(groups: readonly BarGroup[], box: Box): BarGeometry {
  const innerW = Math.max(0, box.width - box.margin.left - box.margin.right)
  const innerH = Math.max(0, box.height - box.margin.top - box.margin.bottom)
  const max = Math.max(0, ...groups.flatMap((g) => [plotValue(g.income), plotValue(g.expense)]))
  const y = scaleLinear()
    .domain([0, max || 1])
    .range([innerH, 0])
  const band = scaleBand<string>()
    .domain(groups.map((g, i) => `${i}:${g.label}`))
    .range([0, innerW])
    .paddingInner(0.25)
    .paddingOuter(0.1)
  const inner = scaleBand<string>()
    .domain(['income', 'expense'])
    .range([0, band.bandwidth()])
    .padding(0.1)
  const baseline = box.margin.top + innerH

  const bars: BarGeometry['bars'] = []
  const labels: BarGeometry['labels'] = []
  groups.forEach((g, i) => {
    const gx = box.margin.left + (band(`${i}:${g.label}`) ?? 0)
    labels.push({ label: g.label, x: gx + band.bandwidth() / 2 })
    for (const kind of ['income', 'expense'] as const) {
      const v = plotValue(g[kind])
      const top = y(v)
      bars.push({
        label: g.label,
        kind,
        value: g[kind],
        x: gx + (inner(kind) ?? 0),
        y: box.margin.top + top,
        width: inner.bandwidth(),
        height: Math.max(0, innerH - top),
      })
    }
  })
  return { bars, labels, max, baseline }
}

// ---- donut chart ---------------------------------------------------------------

export interface Slice {
  key: string
  amount: string
}

export interface DonutArc {
  key: string
  path: string
  startAngle: number
  endAngle: number
  /** Share of the whole, as a fraction 0..1 (geometry only; the displayed % comes from the server). */
  fraction: number
}

export function donutGeometry(slices: readonly Slice[], outer: number, inner: number): DonutArc[] {
  // Zero and negative amounts have no share of the ring, so they get no arc (not even a padding sliver).
  const drawn = slices.filter((s) => plotValue(s.amount) > 0)
  if (drawn.length === 0) return []
  const arcs = pie<Slice>()
    .sort(null)
    .padAngle(drawn.length > 1 ? 0.02 : 0)
    .value((s) => plotValue(s.amount))(drawn)
  const gen = arc<{ startAngle: number; endAngle: number }>().innerRadius(inner).outerRadius(outer)
  return arcs.map((a) => ({
    key: a.data.key,
    path: gen(a) ?? '',
    startAngle: a.startAngle,
    endAngle: a.endAngle,
    fraction: (a.endAngle - a.startAngle) / (2 * Math.PI),
  }))
}
