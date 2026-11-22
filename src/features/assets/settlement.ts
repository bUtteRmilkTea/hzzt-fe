import { Decimal } from '@/shared/money'

const DECIMAL = /^\d+(\.\d+)?$/

/** Why a settlement amount can't be sent, or null when it can. The server enforces the same cap. */
export function settlementProblem(amount: string, outstanding: string): string | null {
  if (!DECIMAL.test(amount) || new Decimal(amount).isZero())
    return 'Enter an amount greater than zero.'
  if (new Decimal(amount).greaterThan(outstanding)) return "That's more than what is outstanding."
  return null
}

/** What will be left outstanding after settling `amount`. Display only: the server returns the real value. */
export function outstandingAfter(outstanding: string, amount: string): string {
  if (!DECIMAL.test(amount)) return outstanding
  const left = new Decimal(outstanding).minus(amount)
  return left.isNegative() ? '0' : left.toFixed()
}
