// Runs after `vite build`: writes dist/_headers and dist/_redirects.
import { readFileSync, writeFileSync } from 'node:fs'
import { loadEnv } from 'vite'
import { buildHeaders, inlineScripts, redirects, scriptHash } from './headers.mjs'

const dist = new URL('../dist/', import.meta.url)
const html = readFileSync(new URL('index.html', dist), 'utf8')
const env = { ...loadEnv('production', process.cwd(), ''), ...process.env }

const hashes = inlineScripts(html).map(scriptHash)
if (hashes.length === 0) {
  console.warn(
    'gen-headers: no inline script found in dist/index.html (the theme boot script is missing?)',
  )
}

writeFileSync(
  new URL('_headers', dist),
  buildHeaders({
    scriptHashes: hashes,
    apiBase: env.VITE_API_BASE_URL || '/api/v1',
    sentryDsn: env.VITE_SENTRY_DSN || '',
  }),
)
writeFileSync(new URL('_redirects', dist), redirects())
console.log(
  `gen-headers: wrote dist/_headers (${hashes.length} inline script hash) and dist/_redirects`,
)
