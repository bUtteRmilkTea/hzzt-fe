import { useEffect, useState } from 'react'
import { prefersReducedMotion } from '@/shared/motion/timings'
import { Amount } from '@/shared/ui/Amount'
import { cn } from '@/shared/ui/cn'

/** One loop of the scene, in ms. Matches `--auth-loop` in globals.css. */
const LOOP_MS = 9000

/** Gentle upward line, drawn in a 320x120 box. pathLength is 1 so the dash animation needs no measuring. */
const LINE = 'M0 98 C30 92 45 80 70 82 S112 62 140 58 S186 66 212 42 S272 26 320 12'
const AREA = `${LINE} L320 120 L0 120 Z`

/**
 * Re-mounts its child every loop, so the number counts up again with the line.
 * Under reduced motion it never re-mounts: the number simply shows its final value.
 */
function Loop({ children }: { children: (n: number) => React.ReactNode }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (prefersReducedMotion()) return
    const id = setInterval(() => setN((v) => v + 1), LOOP_MS)
    return () => clearInterval(id)
  }, [])
  return <>{children(n)}</>
}

/**
 * The brand side of the sign-in screens (F20, D-F23, F22): it sits on the page's own background (no panel surface or divider) with a short looping scene,
 * a net-worth line that draws while the figure beside it counts up, and two soft cards that drift.
 * Pure decoration: it is aria-hidden and carries no information, and the screens work without it.
 * CSS and inline SVG only. Under OS reduced motion it shows one finished frame (see globals.css).
 */
export function AuthPanel({ className }: { className?: string }) {
  return (
    <section
      aria-hidden
      data-testid="auth-panel"
      className={cn('relative flex flex-col gap-10', className)}
    >
      <p className="text-2xl font-semibold">HZZT</p>

      <div className="relative w-full max-w-md">
        <div className="auth-card rounded-xl border border-border bg-surface-2 p-6 shadow-card">
          <p className="text-sm text-label-secondary">Net worth</p>
          <Loop>
            {(n) => (
              <Amount
                key={n}
                animate
                value="128450000"
                currency="IDR"
                className="text-3xl font-semibold"
              />
            )}
          </Loop>
          <svg
            viewBox="0 0 320 120"
            className="mt-6 block h-auto w-full overflow-visible"
            data-testid="auth-line"
          >
            <title>Net worth rising</title>
            <path d={AREA} className="auth-area fill-positive/15" />
            <path
              d={LINE}
              pathLength={1}
              fill="none"
              strokeWidth={3}
              strokeLinecap="round"
              className="auth-line stroke-positive"
            />
          </svg>
        </div>

        <div className="auth-float auth-float-a absolute -top-6 -right-4 hidden rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm shadow-card xl:block">
          <p className="text-label-secondary">Salary</p>
          <p className="font-semibold text-positive">+IDR 5,000,000</p>
        </div>
        <div className="auth-float auth-float-b absolute -bottom-6 -left-4 hidden rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm shadow-card xl:block">
          <p className="text-label-secondary">Coffee</p>
          <p className="font-semibold text-negative">-IDR 25,000</p>
        </div>
      </div>

      <div>
        <p className="text-2xl font-semibold xl:text-3xl">Know where your money goes.</p>
        <p className="mt-2 max-w-sm text-label-secondary">
          Wallets, spending, investments and goals in one calm place.
        </p>
      </div>
    </section>
  )
}
