// Builds the static-host files (`_headers`, `_redirects`) that harden and serve the SPA.
// Understood by Cloudflare Pages and Netlify; see README for the Vercel equivalent.
import { createHash } from 'node:crypto'

/** `sha256-...` source for an inline script, exactly as the browser computes it. */
export const scriptHash = (source) =>
  `'sha256-${createHash('sha256').update(source, 'utf8').digest('base64')}'`

/** Every inline `<script>` body in an HTML document (scripts without a `src`). */
export function inlineScripts(html) {
  return [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .filter((s) => s.trim() !== '')
}

const origin = (url) => {
  try {
    return new URL(url).origin
  } catch {
    return null // a relative base like /api/v1 is same-origin, covered by 'self'
  }
}

/**
 * The Content-Security-Policy. Scripts are locked to 'self' plus the hash of the inline theme boot
 * script: there is no 'unsafe-inline' for scripts. Styles keep 'unsafe-inline' on purpose: Vaul injects
 * a <style> element at runtime and components set `style` attributes for computed layout and user colours.
 */
export function buildCsp({ scriptHashes = [], apiBase = '/api/v1', sentryDsn = '' } = {}) {
  const connect = ["'self'"]
  const api = origin(apiBase)
  if (api) connect.push(api)
  if (sentryDsn) {
    const dsn = origin(sentryDsn)
    if (dsn) connect.push(dsn)
    connect.push(
      'https://*.ingest.sentry.io',
      'https://*.ingest.de.sentry.io',
      'https://*.ingest.us.sentry.io',
    )
  }
  return [
    "default-src 'self'",
    `script-src 'self' ${scriptHashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connect.join(' ')}`,
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

const IMMUTABLE = 'public, max-age=31536000, immutable'

export function buildHeaders(opts) {
  return `/*
  Content-Security-Policy: ${buildCsp(opts)}
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()

# Hashed build output never changes under the same name.
/assets/*
  Cache-Control: ${IMMUTABLE}

# Not hashed, so only a short cache.
/fonts/*
  Cache-Control: public, max-age=604800
/icons/*
  Cache-Control: public, max-age=86400

# The entry point, the service worker and the manifest must always be revalidated,
# or a new deployment would not reach open tabs.
/index.html
  Cache-Control: no-cache
/sw.js
  Cache-Control: no-cache
/manifest.webmanifest
  Cache-Control: no-cache
`
}

/** Single-page app fallback: any path that is not a file serves index.html. */
export const redirects = () => '/*  /index.html  200\n'
