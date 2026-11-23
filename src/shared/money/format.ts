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

/** Currencies shown without decimals. Every other currency is capped at 2. */
const ZERO_DECIMAL = new Set(['IDR', 'JPY'])
const MAX_DISPLAY_DIGITS = 2

/** Decimals used for display and input: IDR/JPY 0, everything else min(minor units, 2). */
export function displayDigits(currency: string): number {
  const code = currency.toUpperCase()
  return ZERO_DECIMAL.has(code) ? 0 : Math.min(minorUnits(code), MAX_DISPLAY_DIGITS)
}

export interface FormatOptions {
  /** 'always' prefixes + for positives, 'exceptZero' hides the sign on zero. Default 'auto'. */
  signDisplay?: 'auto' | 'always' | 'exceptZero' | 'never'
  /** Drop the currency symbol and return only the grouped number. */
  withoutSymbol?: boolean
  /** Short form for tight spaces (1.3M). Display only: it rounds, so never use it where exactness matters. */
  compact?: boolean
  locale?: string
}

/** Format an API money string for display. Never goes through Number(). */
export function format(
  amount: string | Decimal,
  currency: string,
  opts: FormatOptions = {},
): string {
  const digits = displayDigits(currency)
  // Round with Decimal so the result is exact, then let Intl group the string.
  const rounded = toDecimal(amount).toDecimalPlaces(digits, Decimal.ROUND_HALF_UP).toFixed(digits)
  const nf = new Intl.NumberFormat(opts.locale ?? 'en-US', {
    style: opts.withoutSymbol ? 'decimal' : 'currency',
    currency: currency.toUpperCase(),
    ...(opts.compact
      ? { notation: 'compact' as const, maximumFractionDigits: MAX_DISPLAY_DIGITS }
      : { minimumFractionDigits: digits, maximumFractionDigits: digits }),
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
  const digits = displayDigits(currency)
  return toDecimal(cleaned === '.' ? '0' : cleaned)
    .toDecimalPlaces(digits, Decimal.ROUND_HALF_UP)
    .toFixed(digits)
}

/** Sign of an API money string: -1, 0 or 1. */
export function signOf(amount: string | Decimal): -1 | 0 | 1 {
  const d = toDecimal(amount)
  return d.isZero() ? 0 : d.isNegative() ? -1 : 1
}

const PREFIXES: Record<string, string> = {
  IDR: 'Rp',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  SGD: 'S$',
}

/** The short prefix shown inside a price input: `Rp`, `$`, or the currency code. */
export function currencyPrefix(code: string): string {
  return PREFIXES[code] ?? code
}
