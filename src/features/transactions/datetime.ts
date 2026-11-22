/** Local calendar date as `YYYY-MM-DD`. */
export function localDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * ISO timestamp for a transaction on a chosen local day. Today keeps the current time
 * (so it sorts newest-first); any other day uses midday, which stays on that day in any timezone offset.
 */
export function occurredAtFor(day: string, now: Date = new Date()): string {
  if (day === localDate(now)) return now.toISOString()
  return new Date(`${day}T12:00:00`).toISOString()
}

/** The local `YYYY-MM-DD` of an ISO timestamp. */
export function dayOf(iso: string): string {
  return localDate(new Date(iso))
}
