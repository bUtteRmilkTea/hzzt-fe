/**
 * Where "Add transaction" goes back to when it closes. The value arrives in the URL, so it is
 * untrusted. It must be an in-app path under /s/ or /settings, with an optional query string.
 * No scheme, no host, no `//`, no `\\`, no `#`, and only visible ASCII. Anything else is dropped and
 * the caller falls back to History, which prevents an open redirect.
 */
const MAX = 500
const PREFIXES = ['/s/', '/settings']

export function safeReturnTo(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > MAX) return undefined
  if (!PREFIXES.some((p) => value.startsWith(p))) return undefined
  if (value.includes('//') || value.includes('\\') || value.includes('#')) return undefined
  // Only visible ASCII: this also rules out control characters and whitespace tricks.
  if (!/^[\x21-\x7e]+$/.test(value)) return undefined
  const q = value.indexOf('?')
  const path = q === -1 ? value : value.slice(0, q)
  // A colon is fine in a query value (a time, say) but never in the path (that is how a scheme hides).
  if (path.includes(':')) return undefined
  return value
}

/** The return path for the current location, or undefined if it is not safe or is the add sheet itself. */
export function returnToFor(location: {
  pathname: string
  searchStr?: string
}): string | undefined {
  if (location.pathname.includes('/transactions/new')) return undefined
  return safeReturnTo(`${location.pathname}${location.searchStr ?? ''}`)
}
