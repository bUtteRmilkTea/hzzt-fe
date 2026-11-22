import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.gen.ts'))
      out.push(p)
  }
  return out
}

// Input/calc code that needs exact Decimal strings, not display. Reviewed and allowed.
const ALLOWED_TOFIXED = [
  'src/shared/charts/pct.ts', // percent shares, not money
  'src/shared/money/',
  'src/features/investments/trade.ts',
  'src/features/investments/valuation.ts', // exact Decimal sums, rendered through Amount
  'src/features/investments/wrappers.ts', // percent strings
  'src/features/investments/WrapperPercentInline.tsx', // percent hint
  'src/features/investments/schema.ts',
  'src/features/investments/shares.ts',
  'src/features/investments/TradeSheet.tsx',
  'src/features/investments/SharingScreen.tsx', // percent, not money
  'src/features/goals/reserve.ts',
  'src/features/assets/settlement.ts',
  'src/features/spaces/CurrencyScreen.tsx',
  'src/features/wallets/EditWalletScreen.tsx',
  'src/features/categories/BudgetProgress.tsx',
]

describe('money formatting does not leak', () => {
  const files = walk('src')
  it('Intl.NumberFormat is only used inside shared/money', () => {
    const bad = files.filter(
      (f) =>
        !f.startsWith('src/shared/money/') && readFileSync(f, 'utf8').includes('Intl.NumberFormat'),
    )
    expect(bad).toEqual([])
  })
  it('toFixed( appears only in reviewed calculation code', () => {
    const bad = files.filter(
      (f) =>
        !ALLOWED_TOFIXED.some((a) => f.startsWith(a)) &&
        readFileSync(f, 'utf8').includes('toFixed('),
    )
    expect(bad).toEqual([])
  })
})
