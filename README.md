# hzzt-fe

React 19 + TypeScript + Vite frontend for the asset-management app: wallets, transactions, investments,
net worth and goals, as an installable PWA. The plan lives in `plan/plan.md`; the backend is a separate repo.

## Setup from a clean WSL install

Work on the Linux filesystem (`~/...`), never under `/mnt/c`. A Windows `node.exe` on the PATH can shadow the
Linux one: `which node` must not start with `/mnt/c`.

```bash
sudo apt install -y curl unzip
curl -fsSL https://fnm.vercel.app/install | bash        # then open a new shell
fnm install 22 && fnm default 22
corepack enable && corepack prepare pnpm@latest --activate

git clone <this repo> && cd hzzt-fe
pnpm install
cp .env.example .env
sudo env "PATH=$PATH" "$(which pnpm)" exec playwright install-deps chromium   # one time: system libraries for e2e
pnpm exec playwright install chromium
pnpm dev                                                 # http://localhost:5173
```

## Scripts

| Script                      | What it does                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                  | Dev server on :5173; `/api` is proxied to `API_PROXY_TARGET`                                             |
| `pnpm build`                | Typecheck, production build (with the service worker), then writes `dist/_headers` and `dist/_redirects` |
| `pnpm size`                 | Bundle budget and deployment-artefact checks. Run after `build`; CI fails on any breach                  |
| `pnpm lint` / `pnpm format` | Biome (also bans raw hex colours and `parseFloat`)                                                       |
| `pnpm typecheck`            | `tsc -b`                                                                                                 |
| `pnpm test`                 | Vitest + Testing Library + MSW, including the axe accessibility run and the token contrast audit         |
| `pnpm test:e2e`             | Playwright, Chromium headless. The API is faked in the browser, so no backend is needed                  |
| `pnpm gen:api`              | Regenerate `src/shared/api/schema.d.ts` from `api/swagger.yaml`                                          |
| `pnpm sync:api`             | Copy the backend's `../hzzt/docs/swagger.yaml` here, then regenerate                                     |

## Environment variables

All are read at **build time** (Vite). `.env` is gitignored; never commit it or a secret.

| Variable            | Purpose                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| `VITE_API_BASE_URL` | API prefix the browser calls. Keep it relative (`/api/v1`) so the refresh cookie stays same-site |
| `API_PROXY_TARGET`  | Where the dev server proxies `/api` (e.g. `http://localhost:8080`)                               |
| `VITE_ENABLE_MSW`   | `true` serves MSW mocks in the browser during dev                                                |
| `VITE_SENTRY_DSN`   | Turns on error reporting (off when unset, and then nothing is downloaded)                        |
| `E2E_REAL_API`      | `1` runs `full-flow.spec.ts` against a real, freshly seeded backend instead of the browser fake  |

## Regenerating the API types

The backend emits Swagger 2.0. `pnpm gen:api` converts it with `swagger2openapi` and generates `schema.d.ts` with
`openapi-typescript` (run through a pinned `dlx` with TypeScript 5.9, because TypeScript 7 has no compiler API).
Both generated files are committed and CI fails if they drift. After a backend change: `pnpm sync:api`, then commit.

## Deployment

`pnpm build` produces a static site in `dist/`. Host it **on the same site as the API** (for example
`app.example.com` and `api.example.com`): the refresh cookie requires it. The build already contains:

| File                            | Purpose                                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `_redirects`                    | SPA fallback: every path serves `index.html`                                                             |
| `_headers`                      | Content-Security-Policy, `Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, and cache rules |
| `sw.js`, `manifest.webmanifest` | The service worker and the web app manifest (maskable icons included)                                    |

`_headers` and `_redirects` are understood by **Cloudflare Pages** and **Netlify** as they are. On **Vercel**, translate
the same rules into `vercel.json` (`rewrites` to `/index.html`, and a `headers` entry per path below).

Cache rules (all verified by `pnpm size` where they can be):

- `/assets/*` is hashed, so it is `public, max-age=31536000, immutable`.
- `/index.html`, `/sw.js` and `/manifest.webmanifest` are `no-cache`, so a new deployment reaches open tabs.
- `/fonts/*` and `/icons/*` are not hashed, so they get a short cache.

### Rolling out a new version

1. Deploy `dist/` (replace everything; old hashed files may be kept for a while).
2. Open tabs notice the new service worker and show **"A new version is available. Update"**. A tab that tries to
   load a chunk the new deployment removed shows the same prompt instead of breaking.
3. Nothing to purge: `index.html` is never cached.

### Content-Security-Policy

Scripts are locked to `'self'` plus the **hash** of the one inline script (the theme boot script that prevents a flash
of the wrong theme). There is no `'unsafe-inline'` for scripts, and `pnpm size` fails if that changes or the hash goes
stale. Styles keep `'unsafe-inline'` on purpose: Vaul (the bottom sheet) injects a `<style>` element at runtime, and
components set `style` attributes for computed layout and user-chosen colours. If `VITE_API_BASE_URL` is an absolute
URL, its origin is added to `connect-src`; if `VITE_SENTRY_DSN` is set, the Sentry ingest hosts are too.

### Offline and the service worker

The worker precaches the app shell and static assets only. **API responses are never cached or served by it** (checked
by `pnpm size`). While offline a banner appears, screens keep showing what is already loaded, and saving is refused
with "You're offline. Reconnect to save changes." Offline writes are not queued.

### Error reporting

Off unless `VITE_SENTRY_DSN` is set. The SDK is a separate lazy chunk (`sentry-*.js`) that is only fetched when
enabled, with its own 150 KB limit outside the route budget. Events are scrubbed (tokens, passwords, PINs, cookies,
request bodies) and every API error carries its `requestId`.

## Quality gates

- **Bundle budget** (gzip): initial JS 150 KB, any route chunk 60 KB, CSS 25 KB. The charts and Sentry chunks must never
  be part of the initial load.
- **Accessibility**: axe runs on every route and key sheets in the unit tests; WCAG contrast for the design tokens is
  audited in both themes.
- **Lighthouse** (performance, accessibility and best practices at 90 or more on Home and History, throttled as mobile)
  needs a deployed or seeded app. `lighthouserc.json` holds the assertions; run it against `pnpm preview` with a real
  space id, or use PageSpeed Insights on the deployed site.

## WSL notes

- If HMR stops firing, raise the watcher limit:
  `echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p`
- `.gitattributes` forces LF line endings. Keep `git config core.autocrlf input`.
- Regenerate the PWA icons with `node scripts/gen-icons.mjs` (no image tooling needed).
