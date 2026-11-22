import { toDecimal } from '@/shared/money'

const clamp = (n: number) => Math.min(100, Math.max(0, n))
/** Bar geometry only (pixels and percents), never displayed: the figures shown come from the server. */
const pctWidth = (v: string) => clamp(toDecimal(v).toNumber())

/**
 * A compact target-versus-actual bar: the fill is the actual share of the category, the tick is
 * the target. It replaces the old 60px pie in every account header.
 */
export function TargetBar({
  actualPct,
  targetPct,
  label,
}: {
  actualPct: string
  targetPct: string | null
  label: string
}) {
  return (
    <div
      role="img"
      aria-label={
        targetPct
          ? `${label}: ${actualPct}% of the category, target ${targetPct}%`
          : `${label}: ${actualPct}% of the category, no target`
      }
      data-testid="target-bar"
      className="relative h-1.5 w-full rounded-full bg-surface-3"
    >
      <div
        className="h-full rounded-full bg-chart-1"
        style={{ width: `${pctWidth(actualPct)}%` }}
      />
      {targetPct ? (
        <div
          data-testid="target-tick"
          className="absolute -top-0.5 h-2.5 w-0.5 rounded-full bg-label"
          style={{ left: `${pctWidth(targetPct)}%` }}
        />
      ) : null}
    </div>
  )
}
