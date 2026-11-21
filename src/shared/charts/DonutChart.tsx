import type { CSSProperties } from 'react'
import { Decimal } from '@/shared/money'
import { useInView } from '@/shared/motion/useInView'
import { Amount } from '@/shared/ui/Amount'
import { cn } from '@/shared/ui/cn'
import { useCountUp } from '@/shared/ui/useCountUp'
import { donutGeometry, type Slice } from './geometry'

export interface DonutSlice extends Slice {
  name: string
  icon?: string
  /** A CSS colour: a user-chosen category colour, or a token like `var(--label-tertiary)`. */
  color: string
  /** The share exactly as the server computed it, e.g. "42.50". */
  pct: string
  count: number
  /** Slices with no target (uncategorised) are drawn but not clickable. */
  interactive?: boolean
}

interface DonutChartProps {
  slices: readonly DonutSlice[]
  currency: string
  label: string
  /** Shown in the middle: the total transaction count. */
  centre: { value: string; caption: string }
  onSelect?: (key: string) => void
  size?: number
  /** Sweep the slices in, and count the centre number up. */
  draw?: boolean
}

/** A category donut with a count in the middle, a legend, and slices that can be tapped through. */
export function DonutChart({
  slices,
  currency,
  label,
  centre,
  onSelect,
  size = 180,
  draw,
}: DonutChartProps) {
  // The centre is a transaction count: count it up with the same Decimal interpolation as <Amount animate>.
  const countable = Boolean(draw) && /^\d+$/.test(centre.value)
  const [viewRef, seen] = useInView(Boolean(draw))
  const counted = useCountUp(centre.value, countable, undefined, seen)
  const centreText = countable ? new Decimal(counted).toDecimalPlaces(0).toString() : centre.value
  const outer = size / 2 - 4
  const arcs = donutGeometry(slices, outer, outer * 0.62)
  const byKey = new Map(slices.map((s) => [s.key, s]))
  if (arcs.length === 0)
    return (
      <p className="py-6 text-center text-sm text-label-secondary">
        Nothing to show for this period.
      </p>
    )

  return (
    <div
      ref={viewRef}
      data-inview={draw ? seen : undefined}
      className="flex flex-col items-center gap-4"
      data-testid="donut-chart"
    >
      <svg width={size} height={size} role="img" aria-label={label} className="block">
        <title>{label}</title>
        <g transform={`translate(${size / 2},${size / 2})`}>
          {arcs.map((a, i) => {
            const s = byKey.get(a.key)
            if (!s) return null
            const tappable = Boolean(onSelect) && s.interactive !== false
            return (
              <path
                key={a.key}
                d={a.path}
                style={{ fill: s.color, ...(draw ? ({ '--i': i } as CSSProperties) : {}) }}
                data-slice={a.key}
                // Pointer users can tap a slice. Keyboard and screen-reader users use the legend buttons below.
                aria-hidden
                onClick={tappable ? () => onSelect?.(a.key) : undefined}
                className={cn(tappable && 'cursor-pointer', draw && 'chart-slice')}
              />
            )
          })}
          <text textAnchor="middle" y={-2} className="fill-label text-2xl font-semibold">
            {centreText}
          </text>
          <text textAnchor="middle" y={16} className="fill-label-secondary text-[11px]">
            {centre.caption}
          </text>
        </g>
      </svg>

      <ul className="flex w-full flex-col gap-1">
        {slices.map((s) => {
          const content = (
            <>
              <span
                aria-hidden
                style={{ backgroundColor: s.color }}
                className="size-3 shrink-0 rounded-full"
              />
              <span aria-hidden className="text-base">
                {s.icon}
              </span>
              <span className="min-w-0 flex-1 truncate text-left">{s.name}</span>
              <span className="tabular text-label-secondary">{s.pct}%</span>
              <Amount
                value={s.amount}
                currency={currency}
                className="w-28 text-right font-medium"
              />
            </>
          )
          return (
            <li key={s.key}>
              {onSelect && s.interactive !== false ? (
                <button
                  type="button"
                  onClick={() => onSelect(s.key)}
                  className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 hover:bg-surface-3"
                >
                  {content}
                </button>
              ) : (
                <div className="flex min-h-11 w-full items-center gap-2 px-2">{content}</div>
              )}
            </li>
          )
        })}
      </ul>

      {/* The wrapper clips it: a bare sr-only table ignores width:1px and widens the page. */}
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Share</th>
              <th scope="col">Amount</th>
              <th scope="col">Transactions</th>
            </tr>
          </thead>
          <tbody>
            {slices.map((s) => (
              <tr key={s.key}>
                <th scope="row">{s.name}</th>
                <td>{s.pct}%</td>
                <td>
                  <Amount value={s.amount} currency={currency} />
                </td>
                <td>{s.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
