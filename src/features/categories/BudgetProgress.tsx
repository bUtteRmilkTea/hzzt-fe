import { Decimal } from '@/shared/money'
import { Amount } from '@/shared/ui/Amount'
import { cn } from '@/shared/ui/cn'

interface BudgetProgressProps {
  /** The server's `budgetUsedPct`, e.g. "42.50". Shown as given and never recomputed here. */
  usedPct: string
  spent: string
  budget: string
  remaining: string | undefined
  currency: string
}

/** Bar width is clamped to the track for display only; the number shown is the server's. */
export function barWidth(usedPct: string): number {
  const d = new Decimal(usedPct)
  if (d.isNegative()) return 0
  return Math.min(100, Math.max(0, Number(d.toDecimalPlaces(2).toFixed(2))))
}

export function isOverBudget(usedPct: string): boolean {
  return new Decimal(usedPct).greaterThan(100)
}

export function BudgetProgress({
  usedPct,
  spent,
  budget,
  remaining,
  currency,
}: BudgetProgressProps) {
  const over = isOverBudget(usedPct)
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="progressbar"
        aria-label="Budget used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={barWidth(usedPct)}
        aria-valuetext={`${usedPct} percent of budget used`}
        className="h-2 overflow-hidden rounded-full bg-surface-3"
      >
        <div
          data-over={over || undefined}
          style={{ width: `${barWidth(usedPct)}%` }}
          className={cn(
            'h-full rounded-full transition-[width] duration-300',
            over ? 'bg-negative' : 'bg-accent',
          )}
        />
      </div>
      <p className="flex flex-wrap justify-between gap-x-3 text-sm text-label-secondary">
        <span>
          <Amount value={spent} currency={currency} /> of{' '}
          <Amount value={budget} currency={currency} />
        </span>
        <span className={cn('tabular', over && 'font-medium text-negative')}>
          {over ? 'Over budget' : `${usedPct}% used`}
          {remaining !== undefined ? (
            <>
              {' · '}
              <Amount value={remaining} currency={currency} /> left
            </>
          ) : null}
        </span>
      </p>
    </div>
  )
}
