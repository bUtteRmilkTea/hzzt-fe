# hzzt-fe

React 19 + TypeScript + Vite frontend for the asset-management app. The plan lives in `plan/plan.md`.

## Setup (WSL2 / Ubuntu)

Work on the Linux filesystem (`~/...`), never under `/mnt/c`.

```bash
# Node 22 via fnm (needs curl and unzip: sudo apt install -y curl unzip)
curl -fsSL https://fnm.vercel.app/install | bash
fnm install 22 && fnm default 22
corepack enable && corepack prepare pnpm@latest --activate

pnpm install
cp .env.example .env
pnpm exec playwright install --with-deps chromium   # one time, needs sudo
```

## Scripts

| Script                      | What it does                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| `pnpm dev`                  | Dev server on http://localhost:5173, `/api` proxied to `localhost:8080`                          |
| `pnpm build`                | Typecheck, then production build to `dist/`                                                      |
| `pnpm size`                 | Bundle budget check (run after `build`): initial JS 150 KB, lazy chunk 60 KB, CSS 25 KB, gzipped |
| `pnpm lint` / `pnpm format` | Biome                                                                                            |
| `pnpm typecheck`            | `tsc -b`                                                                                         |
| `pnpm test`                 | Vitest + Testing Library + MSW                                                                   |
| `pnpm test:e2e`             | Playwright, Chromium headless                                                                    |

## Environment

| Variable            | Purpose                                                                                |
| ------------------- | -------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | API prefix the browser calls. Use `/api/v1` (same-origin, so the refresh cookie works) |
| `API_PROXY_TARGET`  | Where Vite proxies `/api` in dev, e.g. `http://localhost:8080`                         |
| `VITE_ENABLE_MSW`   | `true` serves MSW mocks in the browser during dev                                      |

`.env` is gitignored. Never commit it or any secret.

## WSL notes

- If HMR stops firing, raise the watcher limit:
  `echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p`
- A Windows `node.exe` on the PATH can shadow the Linux one. `which node` must not start with `/mnt/c`.
- `.gitattributes` forces LF line endings. Keep `git config core.autocrlf input`.

## API types

The backend emits Swagger 2.0. `pnpm gen:api` converts it with `swagger2openapi` and generates `src/shared/api/schema.d.ts` with `openapi-typescript` (run through a pinned `dlx` with TypeScript 5.9, because TypeScript 7 has no compiler API). Both generated files are committed and CI fails if they drift. After a backend change: `pnpm sync:api`.
