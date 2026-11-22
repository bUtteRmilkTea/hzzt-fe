import { Decimal } from '@/shared/money'

export const MAX_PARTICIPANTS = 10

export interface ShareRow {
  /** Local key for React. */
  key: string
  isOwner: boolean
  displayName: string
  /** Present for a participant who has an account (they get an invitation). */
  email: string
  /** Percentage with up to two decimals, as typed. */
  sharePct: string
}

const PCT = /^\d{1,3}(\.\d{1,2})?$/

/** True for `0` to `100` with at most two decimals. Anything else cannot be a share. */
export function isValidPct(v: string): boolean {
  return PCT.test(v.trim()) && new Decimal(v).lte(100)
}

/** Exact decimal sum of the rows' shares. Unparseable rows count as 0, so the total never lies upward. */
export function shareTotal(rows: readonly Pick<ShareRow, 'sharePct'>[]): Decimal {
  return rows.reduce(
    (sum, r) => (isValidPct(r.sharePct) ? sum.plus(r.sharePct.trim()) : sum),
    new Decimal(0),
  )
}

export const isExactly100 = (rows: readonly Pick<ShareRow, 'sharePct'>[]): boolean =>
  shareTotal(rows).equals(100)

/** Why the list cannot be submitted, or null when it can. Mirrors the backend's rules. */
export function shareProblem(rows: readonly ShareRow[]): string | null {
  if (rows.length > MAX_PARTICIPANTS)
    return `At most ${MAX_PARTICIPANTS} people can share an investment.`
  if (rows.some((r) => !isValidPct(r.sharePct)))
    return 'Every share must be a percentage with up to 2 decimals.'
  const owner = rows.find((r) => r.isOwner)
  if (!owner || new Decimal(owner.sharePct).lte(0)) return 'You must keep a share above 0%.'
  if (rows.some((r) => !r.isOwner && r.displayName.trim() === '')) return 'Everyone needs a name.'
  if (rows.some((r) => r.email.trim() !== '' && !/^\S+@\S+\.\S+$/.test(r.email.trim())))
    return 'Check the email addresses.'
  if (!isExactly100(rows)) return 'Shares must add up to exactly 100.00%.'
  return null
}

/** The body for `PUT /investments/{id}/participants` (full replacement). */
export function toParticipantsBody(rows: readonly ShareRow[]) {
  return {
    participants: rows.map((r) => ({
      displayName: r.displayName.trim(),
      sharePct: new Decimal(r.sharePct.trim()).toFixed(2),
      ...(r.isOwner ? { isOwner: true } : {}),
      ...(r.email.trim() ? { email: r.email.trim() } : {}),
    })),
  }
}
