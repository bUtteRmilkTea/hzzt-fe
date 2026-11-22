import { Amount } from '@/shared/ui/Amount'
import { type BarGroup, barGeometry } from './geometry'
import { useChartWidth } from './useChartWidth'

interface BarChartProps {
  groups: readonly BarGroup[]
  currency: string
  label: string
  height?: number
}

const MARGIN = { top: 8, right: 8, bottom: 28, left: 8 }

/** Income and expense side by side per bucket. Bucket labels are drawn exactly as the server sent them. */
export function BarChart({ groups, currency, label, height = 180 }: BarChartProps) {
  const { ref, width } = useChartWidth()
  const empty = groups.length === 0 || groups.every((g) => g.income === '0' && g.expense === '0')
  if (empty)
    return (
      <p className="py-6 text-center text-sm text-label-secondary">
        No income or expenses in this period.
      </p>
    )
  const g = barGeometry(groups, { width, height, margin: MARGIN })
  const dense = groups.length > 8

  return (
    <div ref={ref} className="w-full" data-testid="bar-chart">
      <svg width={width} height={height} role="img" aria-label={label} className="block">
        <title>{label}</title>
        <line
          x1={MARGIN.left}
          x2={width - MARGIN.right}
          y1={g.baseline}
          y2={g.baseline}
          className="stroke-border-strong"
        />
        {g.bars.map((b) => (
          <rect
            key={`${b.label}-${b.kind}`}
            data-kind={b.kind}
            x={b.x}
            y={b.y}
            width={Math.max(0, b.width)}
            height={b.height}
            rx={3}
            className={b.kind === 'income' ? 'fill-positive' : 'fill-negative'}
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
      {/* The legend names the two series, so colour is never the only cue. */}
      <ul className="mt-2 flex justify-center gap-4 text-sm text-label-secondary">
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-sm bg-positive" /> Income
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-sm bg-negative" /> Expense
        </li>
      </ul>
      <table className="sr-only">
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
  )
}
