import { buildCsp, buildHeaders, inlineScripts, redirects, scriptHash } from './headers.mjs'

const html = `<!doctype html><html><head>
<script>(() => { document.documentElement.setAttribute('data-theme', 'light') })()</script>
<script type="module" crossorigin src="/assets/index-abc.js"></script>
</head><body><div id="root"></div></body></html>`

describe('inline script hashing', () => {
  it('finds only the inline scripts, not the ones with a src', () => {
    const found = inlineScripts(html)
    expect(found).toHaveLength(1)
    expect(found[0]).toContain('data-theme')
  })
  it('hashes exactly as a browser does (sha256, base64)', () => {
    // Known vector: sha256("abc") in base64.
    expect(scriptHash('abc')).toBe("'sha256-ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0='")
  })
  it('ignores empty script tags', () => {
    expect(inlineScripts('<script> </script><script></script>')).toEqual([])
  })
})

describe('Content-Security-Policy', () => {
  const hash = scriptHash('boot()')
  const csp = buildCsp({ scriptHashes: [hash] })
  const directive = (name: string) => csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? ''

  it('allows scripts only from self and the boot-script hash, with no unsafe-inline', () => {
    expect(directive('script-src')).toBe(`script-src 'self' ${hash}`)
    expect(directive('script-src')).not.toContain('unsafe-inline')
    expect(directive('script-src')).not.toContain('unsafe-eval')
  })
  it('denies framing, plugins and base-uri hijacking', () => {
    expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'")
    expect(directive('object-src')).toBe("object-src 'none'")
    expect(directive('base-uri')).toBe("base-uri 'self'")
    expect(directive('default-src')).toBe("default-src 'self'")
  })
  it('keeps same-origin API calls on self and adds an absolute API origin', () => {
    expect(directive('connect-src')).toBe("connect-src 'self'")
    expect(buildCsp({ apiBase: 'https://api.example.com/api/v1' })).toContain(
      "connect-src 'self' https://api.example.com",
    )
  })
  it('only opens the error tracker when a DSN is configured', () => {
    expect(csp).not.toContain('sentry')
    expect(buildCsp({ sentryDsn: 'https://key@o1.ingest.sentry.io/2' })).toContain(
      'https://*.ingest.sentry.io',
    )
  })
  it('documents why styles keep unsafe-inline (runtime-injected styles and style attributes)', () => {
    expect(directive('style-src')).toBe("style-src 'self' 'unsafe-inline'")
  })
})

describe('static host files', () => {
  const headers = buildHeaders({ scriptHashes: [scriptHash('x')] })
  const block = (path: string) =>
    headers
      .split('\n\n')
      .find((b) => b.split('\n').find((l) => l.startsWith(path)) !== undefined) ?? ''

  it('sets the security headers on every path', () => {
    const all = headers.split('\n\n')[0] as string
    expect(all).toContain('Referrer-Policy: strict-origin-when-cross-origin')
    expect(all).toContain('X-Content-Type-Options: nosniff')
    expect(all).toContain('X-Frame-Options: DENY')
    expect(all).toContain('Content-Security-Policy:')
  })
  it('caches hashed assets forever and never caches the entry point, worker or manifest', () => {
    expect(headers).toMatch(/\/assets\/\*\n\s+Cache-Control: public, max-age=31536000, immutable/)
    for (const path of ['/index.html', '/sw.js', '/manifest.webmanifest']) {
      expect(headers, path).toMatch(
        new RegExp(`${path.replace('.', '\\.')}\\n\\s+Cache-Control: no-cache`),
      )
    }
    expect(block('/fonts/*')).not.toContain('immutable') // unhashed, so not immutable
  })
  it('falls back to index.html for any route (SPA)', () => {
    expect(redirects()).toBe('/*  /index.html  200\n')
  })
})
