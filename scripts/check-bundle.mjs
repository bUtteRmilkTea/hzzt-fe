// Enforces the performance budget from plan/plan.md Section 5.9.
//  - initial JS (entry + modulepreload chunks listed in dist/index.html), gzipped <= 150 KB
//  - any other (lazy) JS chunk, gzipped <= 60 KB
//  - all CSS, gzipped <= 25 KB

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const KB = 1024
// `optional` is the Sentry SDK (D-F12): a lazy chunk that is only fetched when a DSN is configured.
// It is not a route chunk, so it has its own limit instead of the 60 KB route budget.
const BUDGET = { initialJs: 150 * KB, lazyJs: 60 * KB, optionalJs: 150 * KB, css: 25 * KB }
const DIST = new URL('../dist/', import.meta.url).pathname

const gz = (file) => gzipSync(readFileSync(join(DIST, file))).length
const fmt = (n) => `${(n / KB).toFixed(2)} KB`

const html = readFileSync(join(DIST, 'index.html'), 'utf8')
const referenced = new Set(
  [...html.matchAll(/(?:src|href)="\/?(assets\/[^"]+\.js)"/g)].map((m) => m[1]),
)
const assets = readdirSync(join(DIST, 'assets')).map((f) => `assets/${f}`)
const js = assets.filter((f) => f.endsWith('.js'))
const css = assets.filter((f) => f.endsWith('.css'))

const failures = []
const rows = []

// The charts chunk (d3 + our SVG charts) must only load on routes that show a chart,
// so it must never be part of the initial load.
const eagerCharts = js.filter((f) => /\/charts-/.test(f) && referenced.has(f))
if (eagerCharts.length > 0)
  failures.push(`charts chunk is loaded eagerly: ${eagerCharts.join(', ')}`)

const initial = js.filter((f) => referenced.has(f))
const initialSize = initial.reduce((sum, f) => sum + gz(f), 0)
rows.push(['Initial JS', initialSize, BUDGET.initialJs])
if (initialSize > BUDGET.initialJs) failures.push('Initial JS')

for (const f of js.filter((f) => !referenced.has(f))) {
  const size = gz(f)
  const limit = /\/sentry-/.test(f) ? BUDGET.optionalJs : BUDGET.lazyJs
  rows.push([`${limit === BUDGET.optionalJs ? 'Optional chunk' : 'Lazy chunk'} ${f}`, size, limit])
  if (size > limit) failures.push(f)
}

// The optional chunk must never be part of the initial load either.
const eagerSentry = js.filter((f) => /\/sentry-/.test(f) && referenced.has(f))
if (eagerSentry.length > 0)
  failures.push(`sentry chunk is loaded eagerly: ${eagerSentry.join(', ')}`)

const cssSize = css.reduce((sum, f) => sum + gz(f), 0)
rows.push(['CSS', cssSize, BUDGET.css])
if (cssSize > BUDGET.css) failures.push('CSS')

// ---- deployment artefacts (F10): the PWA and the security headers must really be in the build ----
import { existsSync } from 'node:fs'

const need = (file) => {
  if (!existsSync(join(DIST, file))) failures.push(`missing ${file}`)
  return existsSync(join(DIST, file))
}

if (need('sw.js')) {
  const sw = readFileSync(join(DIST, 'sw.js'), 'utf8')
  // The worker precaches the app shell only. API responses must never be cached or served by it.
  if (/\/api\/v1/.test(sw))
    failures.push('sw.js mentions /api/v1: API responses must never be cached')
}
if (need('manifest.webmanifest')) {
  const manifest = JSON.parse(readFileSync(join(DIST, 'manifest.webmanifest'), 'utf8'))
  const icons = manifest.icons ?? []
  const has = (size, purpose) =>
    icons.some((i) => i.sizes === size && (purpose ? i.purpose === purpose : !i.purpose))
  if (!has('192x192')) failures.push('manifest: missing 192x192 icon')
  if (!has('512x512')) failures.push('manifest: missing 512x512 icon')
  if (!has('512x512', 'maskable')) failures.push('manifest: missing maskable icon')
  if (manifest.display !== 'standalone') failures.push('manifest: display must be standalone')
}
if (need('_redirects')) {
  if (!/^\/\*\s+\/index\.html\s+200/m.test(readFileSync(join(DIST, '_redirects'), 'utf8')))
    failures.push('_redirects: SPA fallback missing')
}
if (need('_headers')) {
  const headers = readFileSync(join(DIST, '_headers'), 'utf8')
  const scriptSrc = /script-src ([^;\n]*)/.exec(headers)?.[1] ?? ''
  if (scriptSrc.includes("'unsafe-inline'"))
    failures.push("CSP script-src must not contain 'unsafe-inline'")
  // Every inline script in index.html needs its hash in the CSP, or the browser blocks it.
  for (const m of html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    if (m[1].trim() === '') continue
    const hash = `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`
    if (!scriptSrc.includes(hash))
      failures.push(`CSP is missing the hash of an inline script (${hash})`)
  }
  if (!/frame-ancestors 'none'/.test(headers))
    failures.push("CSP must deny framing (frame-ancestors 'none')")
}

for (const [name, size, limit] of rows) {
  const ok = size <= limit ? 'ok  ' : 'FAIL'
  console.log(`${ok} ${name.padEnd(48)} ${fmt(size).padStart(10)} / ${fmt(limit)} (gzip)`)
}

if (failures.length > 0) {
  console.error(`\nBundle budget exceeded: ${failures.join(', ')}`)
  process.exit(1)
}
console.log('\nBundle budget OK')
