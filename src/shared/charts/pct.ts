import { Decimal, toDecimal } from '@/shared/money'

/**
 * Shares of a whole at 2 decimals that add up to exactly 100.00 (largest remainder).
 * Zero and negative values get "0.00". Presentation only: the amounts stay the server's.
 */
export function allocatePct(values: readonly string[]): string[] {
  const nums = values.map((v) => {
    const d = toDecimal(v)
    return d.isNegative() ? new Decimal(0) : d
  })
  const total = nums.reduce((a, b) => a.plus(b), new Decimal(0))
  if (total.isZero()) return values.map(() => '0.00')
  const exact = nums.map((n) => n.times(10000).div(total)) // basis points
  const floor = exact.map((e) => e.toDecimalPlaces(0, Decimal.ROUND_DOWN))
  let left = 10000 - floor.reduce((a, b) => a + b.toNumber(), 0)
  const order = exact
    .map((e, i) => ({ i, r: e.minus(floor[i] as Decimal) }))
    .sort((a, b) => b.r.comparedTo(a.r) || a.i - b.i)
  const bps = floor.map((f) => f.toNumber())
  for (const { i } of order) {
    if (left <= 0) break
    if ((nums[i] as Decimal).isZero()) continue
    bps[i] = (bps[i] as number) + 1
    left--
  }
  return bps.map((b) => new Decimal(b).div(100).toFixed(2))
}
