import { Decimal } from '@/shared/money'

const DECIMAL = /^\d+(\.\d+)?$/

/**
 * The most a goal can reserve on a wallet: what is still available plus what this goal already
 * holds there (replacing its own reservation does not count against it twice).
 */
export function maxReserve(available: string, currentReserve: string): string {
  return new Decimal(available).plus(currentReserve).toFixed()
}

/** Why a reservation can't be saved, or null. A reservation of 0 clears it and is always allowed. */
export function reserveProblem(
  amount: string,
  available: string,
  currentReserve: string,
): string | null {
  if (amount === '') return null
  if (!DECIMAL.test(amount)) return 'Enter a number.'
  if (new Decimal(amount).greaterThan(maxReserve(available, currentReserve))) {
    return 'That is more than the available balance in this wallet.'
  }
  return null
}

/** What the wallet has left available after this reservation. Display only. */
export function availableAfter(available: string, currentReserve: string, amount: string): string {
  const next = DECIMAL.test(amount) ? new Decimal(amount) : new Decimal(0)
  return new Decimal(available).plus(currentReserve).minus(next).toFixed()
}

/** Ring stroke offset for a percentage: full circumference is empty, 0 is full. Clamped to 0..100. */
export function ringOffset(pct: string | number | undefined, circumference: number): number {
  const n = typeof pct === 'number' ? pct : Number(pct)
  const clamped = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0
  return circumference * (1 - clamped / 100)
}
