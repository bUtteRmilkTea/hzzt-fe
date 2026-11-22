/**
 * Where "Add transaction" goes back to when it closes. The value arrives in the URL, so it is
 * untrusted: only an in-app path under /s/ is accepted (no scheme, no host, no `//`, no `\`),
 * otherwise the caller falls back to History. This prevents an open redirect.
 */
export function safeReturnTo(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 200) return undefined
  if (!value.startsWith('/s/')) return undefined
  if (value.includes('//') || value.includes('\\') || value.includes(':')) return undefined
  // Only visible ASCII: this also rules out control characters and whitespace tricks.
  if (!/^[\x21-\x7e]+$/.test(value)) return undefined
  return value
}
