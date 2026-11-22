/** Only same-site relative paths may be used as a post-login redirect (blocks open redirects). */
export function safeRedirect(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return undefined
  return value
}
