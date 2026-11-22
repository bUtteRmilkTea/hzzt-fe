import Decimal from 'decimal.js-light'

// Exact arithmetic for money. Rounding is half-up (the same direction Intl uses).
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP })

export { Decimal }

/** Parse an API money string into a Decimal. Throws on malformed input. */
export function toDecimal(value: string | Decimal): Decimal {
  return value instanceof Decimal ? value : new Decimal(value.trim())
}
