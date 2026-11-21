import { useGrow } from '@/shared/motion/useGrow'
import { cn } from './cn'

interface ProgressRingProps {
  /** Percentage as the server sent it (0 to 100+). Only the drawing is clamped. */
  pct: string | number | undefined
  size?: number
  stroke?: number
  /** Short text shown in the middle, e.g. "42%". */
  label?: string
  achieved?: boolean
  className?: string
}

const clamp = (v: string | number | undefined) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0
}

export function ProgressRing({
  pct,
  size = 64,
  stroke = 6,
  label,
  achieved,
  className,
}: ProgressRingProps) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const shown = clamp(pct)
  const [growRef, grown] = useGrow(shown)
  return (
    <div
      ref={growRef}
      role="progressbar"
      aria-label="Progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={shown}
      aria-valuetext={label ?? `${shown}%`}
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} aria-hidden className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface-3"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - grown / 100)}
          className={cn(
            'transition-[stroke-dashoffset] duration-1000 ease-out',
            achieved ? 'stroke-positive' : 'stroke-accent',
          )}
        />
      </svg>
      {label ? <span className="tabular absolute text-xs font-semibold">{label}</span> : null}
    </div>
  )
}
