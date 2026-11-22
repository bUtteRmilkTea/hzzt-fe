import { Decimal, toDecimal } from './decimal'

const minorCache = new Map<string, number>()

/** Number of minor-unit digits for a currency (IDR 0, USD 2, JPY 0, KWD 3). */
export function minorUnits(currency: string): number {
  const code = currency.toUpperCase()
  const cached = minorCache.get(code)
  if (cached !== undefined) return cached
  let digits = 2
  try {
    digits = new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).resolvedOptions()
      .maximumFractionDigits as number
  } catch {
    // Unknown currency code: fall back to 2.
  }
  minorCache.set(code, digits)
  return digits
}

export interface FormatOptions {
  /** 'always' prefixes + for positives, 'exceptZero' hides the sign on zero. Default 'auto'. */
  signDisplay?: 'auto' | 'always' | 'exceptZero' | 'never'
  /** Drop the currency symbol and return only the grouped number. */
  withoutSymbol?: boolean
  locale?: string
}

/** Format an API money string for display. Never goes through Number(). */
export function format(
  amount: string | Decimal,
  currency: string,
  opts: FormatOptions = {},
): string {
  const digits = minorUnits(currency)
  // Round with Decimal so the result is exact, then let Intl group the string.
  const rounded = toDecimal(amount).toDecimalPlaces(digits, Decimal.ROUND_HALF_UP).toFixed(digits)
  const nf = new Intl.NumberFormat(opts.locale ?? 'en-US', {
    style: opts.withoutSymbol ? 'decimal' : 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: opts.signDisplay ?? 'auto',
  })
  // Intl.NumberFormat v3 formats decimal strings exactly (Node 22, evergreen browsers).
  return nf.format(rounded as unknown as number)
}

/**
 * Normalise what a user typed into a canonical API money string at the currency's
 * minor units. Returns null when the input is not a valid amount.
 */
export function parseInput(input: string, currency: string): string | null {
  const cleaned = input.replace(/[\s_]/g, '').replace(/,/g, '')
  if (!/^-?\d*\.?\d*$/.test(cleaned) || !/\d/.test(cleaned)) return null
  const digits = minorUnits(currency)
  return toDecimal(cleaned === '.' ? '0' : cleaned)
    .toDecimalPlaces(digits, Decimal.ROUND_HALF_UP)
    .toFixed(digits)
}

/** Sign of an API money string: -1, 0 or 1. */
export function signOf(amount: string | Decimal): -1 | 0 | 1 {
  const d = toDecimal(amount)
  return d.isZero() ? 0 : d.isNegative() ? -1 : 1
}
