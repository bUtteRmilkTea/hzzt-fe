# Asset Management App: Frontend Implementation Plan (v1 — React + Vite)

Nov 19, 2026 · @jo

This plan builds one responsive web client for the Go API described in the backend plan: React 19 + Vite, no global state library, developed entirely inside WSL2.

| Field | Value |
| --- | --- |
| Document | Frontend plan, single source of truth for the web client |
| Scope | Frontend only. The backend plan is a separate document and is authoritative for all API contracts. |
| Client | One responsive web app, mobile-first, also used on desktop. Installable as a PWA. No native app. |
| Stack | React 19, TypeScript, Vite, TanStack Router + Query, Tailwind v4, Radix/shadcn, Vaul, Motion (decided — see D-F01) |
| State | No Redux, no Zustand, no global store. Server cache + URL + Context + local state (D-F06) |
| Dev environment | WSL2 (Ubuntu), Node 22 LTS via fnm, pnpm via Corepack, separate GitHub repo |
| Status | Planning. F0 is Ready now. |

## How to use this document

1. Each **phase** is sized for one coding-agent session: one feature area, roughly 6 to 10 tasks, and roughly 10 to 25 files touched.
2. To run a phase, give the agent **Sections 1 to 6** (product, decisions, stack, architecture, conventions, route map) plus the target phase section, using the brief template in **Appendix A**.
3. The agent implements **only that phase**. It must not change shared primitives or the API client from earlier phases unless the phase says so.
4. A phase is **Done** only when its acceptance criteria are verified with evidence: passing tests, a green CI run, and the agent's report. Generated code is not Done.
5. Status legend: `Backlog`, `Ready`, `In Progress`, `Blocked`, `Review`, `Done`.
6. **The backend plan wins on contracts.** No endpoint, field name, enum value or error code is invented here. If a screen needs something the API does not expose, that is an open question in Section 9, not a frontend workaround.
7. **F0 is different**: it sets up Node, pnpm and the repo inside WSL. Each task says whether you do it or an agent does it.

## 1. Product and client summary

One web app, used mostly on a phone, that records cash wallets, income and expenses, transfers, investments, other assets and debts, and savings goals inside a shared Space. It talks to one Go API and holds no business logic of its own.

### 1.1 Confirmed requirements

| # | Requirement |
| --- | --- |
| C1 | Responsive web app, mobile-first, same build on desktop. Installable PWA. |
| C2 | Lightweight and fast: a measured JS budget, enforced in CI (Section 5.9) |
| C3 | Modern minimalist design in the spirit of Apple's: restrained surfaces, one self-hosted typeface (Inter, addendum 5 F23) in light weights, spring motion, drag-dismissable bottom sheets |
| C4 | Email + password auth. No SSO. The access token lives in memory only. |
| C5 | No Redux and no other global state library (D-F06) |
| C6 | Built and run entirely inside WSL2 (D-F07) |

### 1.2 What the frontend owns

The mini-calculator keyboard, dark and light themes, the hide-amounts blur, the app-lock gate screen, card-style previews, chart rendering, offline shell caching, and all formatting of money, dates and percentages. The backend only stores the preferences that drive these.

### 1.3 Out of scope (v1)

Everything the backend lists as out of scope, plus: offline write queueing, a desktop-specific layout beyond responsive breakpoints, in-app charts for individual investments, animation-heavy onboarding, and localisation. English only (D-F04).

### 1.4 Assumptions

- **A1.** Greenfield. A separate repository from the backend, so the two deploy independently.
- **A2.** The screenshots are a product and visual reference, not a pixel spec. We match their structure and density, not their exact colours.
- **A3.** Backend phases P1 to P17 are Done, so F2 onward can be built against a running API. P18 (investment accounts) is Backlog, so F7 leaves a seam for it rather than building it.
- **A4.** The app is served on the same site as the API (`app.example.com` / `api.example.com`), which the refresh cookie requires.

## 2. Decisions

| ID | Decision | Status | Chosen | Blocks |
| --- | --- | --- | --- | --- |
| D-F01 | Framework | Resolved | React 19 + TypeScript + Vite, static SPA. Not Next.js: no SSR need, and a Node server would complicate the same-site cookie setup | F0 |
| D-F02 | Charts | Resolved | Hand-rolled SVG with `d3-scale` and `d3-shape`. Only a line, a bar and a donut are needed; a chart library costs 40 to 90 KB for styling we would override anyway | F9 |
| D-F03 | Themes | Resolved | Dark-first, both themes shipped, following the system setting with a manual override | F1 |
| D-F04 | Language | Resolved | English only in v1, matching the backend's out-of-scope list | all |
| D-F05 | OpenAPI pipeline | Resolved (F2) | The backend still emits Swagger 2.0 (swag v1, `docs/swagger.yaml`), so the frontend converts it: `swagger2openapi` then `openapi-typescript`, via `pnpm gen:api`. No backend change. The spec is vendored at `api/swagger.yaml` (refresh with `pnpm sync:api`); `api/openapi.yaml` and `src/shared/api/schema.d.ts` are committed and CI fails on drift. `openapi-typescript` runs through a pinned `dlx` with TypeScript 5.9 because it needs the TypeScript compiler API, which TypeScript 7 does not provide | F2 |
| D-F06 | Global state library | Resolved | **None.** TanStack Query for server data, URL search params for view state, React Context for session-wide values, `useState` locally (Section 4.2) | all |
| D-F07 | Runtime and package manager | Resolved | Node 22 LTS via `fnm` inside WSL, pnpm via Corepack, both version-pinned | F0 |
| D-F08 | Routing library | Resolved | TanStack Router, for typed routes and typed search params, which carry the transaction filters | F0, F5 |
| D-F09 | Component source | Resolved | shadcn/ui components copied into the repo and restyled to our tokens, not installed as a dependency | F1 |
| D-F10 | Money type on the client | Resolved | `decimal.js-light` everywhere money is parsed or computed. `Number` is banned for money by an ESLint-equivalent Biome rule plus review (Section 5.2) | F1 |
| D-F11 | Form library | Resolved | React Hook Form + Zod, with Zod discriminated unions mirroring the backend's per-type payloads | F1 |
| D-F12 | Error reporting | Resolved (F10) | Sentry browser SDK, behind `VITE_SENTRY_DSN`, loaded lazily as its own `sentry-*` chunk (about 139 KB gzip, only fetched when enabled). It is not a route chunk, so it has its own 150 KB limit instead of the 60 KB route budget. Events are scrubbed and carry the `requestId` | F10 |
| D-F13 | Hosting | **Still open** | Recommended: static hosting on the same site as the API (Cloudflare Pages, Netlify or Vercel), matching the backend's D-02. F10 ships host-neutral files (`_headers`, `_redirects`) that Cloudflare Pages and Netlify read as they are, with Vercel notes in the README. The host itself is your decision | F10 |

D-F13 (hosting) is still your decision; F10's files work on Cloudflare Pages and Netlify without it. Everything else is settled unless you reopen it.

## 3. Tech stack

Every item is pure JavaScript or ships a Linux x64 binary, so all of it installs and runs inside WSL with no Windows-side dependency.

| Concern | Choice | Why |
| --- | --- | --- |
| Language and build | TypeScript (strict) + Vite 6 | Static output, fast HMR, no server runtime |
| Framework | React 19 | Largest ecosystem for sheets and forms, strongest agent fluency |
| Routing | TanStack Router | Typed routes, typed search params, per-route code splitting, loader-based prefetch |
| Server state | TanStack Query v5 | Caching, `useInfiniteQuery` for the backend's cursor pagination, optimistic updates, retry policy |
| API client | `openapi-typescript` + `openapi-fetch` + `openapi-react-query` | Types generated from the backend's OpenAPI file; about 6 KB of runtime; a renamed field breaks the build, not production |
| Forms | React Hook Form + Zod | Uncontrolled inputs keep large forms fast; Zod discriminated unions mirror the backend's investment, card-style and transfer payloads |
| Styling | Tailwind CSS v4 + CSS custom properties | Zero runtime; tokens as variables make theming a one-line swap |
| Primitives | shadcn/ui over Radix, copied in | Accessible dialogs, popovers, tabs, switches; we own the files and the styling |
| Bottom sheets | Vaul | Drag-to-dismiss sheets matching the reference screens; renders as a centred dialog on desktop |
| Animation | Motion with `LazyMotion` + `domAnimation` | Spring physics for sheets and list transitions, about 5 KB after tree-shaking |
| Charts | `d3-scale` + `d3-shape`, rendered as our own SVG | Line (net worth), bars (weekly analytics), donut (category breakdown). No chart library |
| Long lists | TanStack Virtual | Transaction history stays smooth past a few thousand rows |
| Money | `decimal.js-light` | The API sends money as strings; the mini-calculator needs exact arithmetic |
| Dates and formatting | `Intl.NumberFormat` / `Intl.DateTimeFormat` + `date-fns` | Currency and date formatting with no bundled locale data |
| Icons | `lucide-react`, named imports only | Tree-shakes to the icons actually used. Category and wallet icons stay native emoji, as the backend stores emoji |
| Fonts | Self-hosted Inter variable first, the system font only covers the swap (changed in addendum 5, F23) | The same face on every OS; headings are medium weight with tight tracking |
| PWA | `vite-plugin-pwa` (Workbox) | Installable, cached app shell. Caches assets only, never API responses (Section 5.1) |
| Lint and format | Biome | One Rust binary replacing ESLint and Prettier; fast enough to run on every save in WSL |
| Unit and component tests | Vitest + Testing Library + MSW | MSW handlers are generated from the same OpenAPI types, so mocks cannot drift from the contract |
| End-to-end tests | Playwright (Chromium, headless) | Runs headless inside WSL; headed mode needs WSLg |
| Package manager | pnpm via Corepack | Fast, strict, version-pinned in `package.json` |

### 3.1 Deliberately excluded

| Not used | Reason |
| --- | --- |
| Redux, Zustand, Jotai, MobX | Nothing in this app needs a global mutable store (Section 4.2) |
| Next.js, Remix | SSR buys nothing for an authenticated personal dashboard and adds a server to run |
| Recharts, Chart.js, ApexCharts | 40 to 90 KB for three chart shapes |
| Axios | `fetch` through `openapi-fetch` covers it |
| Moment, Luxon | `Intl` plus `date-fns` is smaller |
| A CSS-in-JS runtime | Tailwind plus variables, with no runtime cost |

## 4. Architecture

**Style:** feature-sliced SPA. One Vite build, one route tree, one generated API client. Features own their screens, hooks and schemas; `shared/` owns everything two features both need.

### 4.1 Folder layout

```
src/
  main.tsx                 # router, QueryClient, providers, theme boot
  routes/                  # TanStack Router file routes, thin: layout + data + <Feature> screen
  app/
    providers/             # QueryClientProvider, SessionProvider, SpaceProvider, ThemeProvider
    router.tsx
  shared/
    api/
      schema.d.ts          # GENERATED from openapi.yaml — never edited by hand
      client.ts            # openapi-fetch instance, auth middleware, error normaliser
      queryKeys.ts         # one factory per resource, the single source of cache keys
      errors.ts            # AppError type, backend code -> user-facing message map
    money/                 # Decimal helpers, parse, format, minor units, allocation display
    period/                # period preset <-> search param, label formatting
    ui/                    # Button, Sheet, Field, Switch, Segmented, Amount, EmptyState, Skeleton...
    charts/                # LineChart, BarChart, DonutChart (our own SVG)
    hooks/                 # useDebounce, useMediaQuery, useLongPress...
  features/
    auth/                  # login, register, forgot, reset, session hooks
    spaces/                # space switcher, settings, members, invitations
    preferences/           # preferences, app lock gate, hide amounts, keyboard type
    wallets/               # list, detail, create/edit sheets, card style editor
    transactions/          # list, filters, create/edit, top-up
    transfers/
    categories/            # categories, budgets
    investments/           # per-type forms, valuation display, market search, buy/sell, sharing
    assets/                # manual assets, settlements, net worth summary
    goals/
    dashboard/             # overview, breakdown, analytics, calendar, net worth history
  styles/
    tokens.css             # the design tokens (Appendix B)
    globals.css
test/
  e2e/                     # Playwright specs
  msw/                     # handlers + fixtures
```

**Cross-feature rules**

- A feature never imports from another feature. Anything shared moves to `shared/`.
- Only `shared/api/client.ts` calls `fetch`. Features call generated hooks.
- Only `shared/money` parses or formats money. No component calls `Number()` on an API value.
- Only `shared/ui/Amount` renders a money value, so hide-amounts and the privacy blur are applied in exactly one place.
- Route files stay thin: route definition, search-param schema, suspense boundary, and the feature screen component.

### 4.2 State ownership (no global store)

This is the table to point an agent at when it reaches for a store.

| Kind of state | Lives in | Example |
| --- | --- | --- |
| Server data | TanStack Query cache | Wallets, transactions, investments, net worth |
| View state | URL search params via TanStack Router | Period preset, selected categories and wallets, search text, open tab |
| Session identity | `SessionContext`, filled from `GET /me` | Current user, timezone, auth status |
| Active space | `SpaceContext`, filled from `GET /spaces` + `lastActiveSpaceId` | Space id, base currency, tracking mode, my role |
| Preferences | `PreferencesContext`, filled from `GET /me/preferences` | Hide amounts, keyboard type, app-lock enabled |
| Theme | `ThemeContext` + `localStorage` | Light, dark or system |
| Access token | A module-scoped variable in `shared/api/client.ts` | Never in `localStorage` or Context, so it cannot leak into a render tree or a devtools snapshot |
| Form state | React Hook Form, inside the form | Any create or edit sheet |
| Transient UI | `useState` / `useReducer` in the component | Sheet open, drag position, calculator buffer |

The four Contexts hold values that change at most a few times per session, so re-render cost is not a concern. If one ever becomes hot, the fix is splitting that Context, not adding a store.

### 4.3 Request and render flow

1. A route loads. Its loader calls `queryClient.ensureQueryData` for the data the first paint needs, so the request starts before the component renders.
2. `openapi-fetch` attaches the in-memory access token.
3. On a 401, a single-flight refresh runs `POST /auth/refresh` (the httpOnly cookie travels automatically) and the original request is retried once. A failed refresh clears the session and routes to `/login`.
4. The response is typed from `schema.d.ts`. Money arrives as strings and stays a string until `shared/money` turns it into a `Decimal` or a formatted label.
5. Mutations invalidate by query-key factory. Money-moving mutations invalidate wallets, transactions, net worth and dashboard together, because one ledger write changes all four.

### 4.4 Responsive model

One component tree, two shells. Below 768 px: a floating pill tab bar, full-height Vaul bottom sheets, single-column cards. At 768 px and above: a left sidebar, sheets rendered as centred dialogs or a right side panel, and two- or three-column grids on list pages. The breakpoint is read once through `useMediaQuery` and passed down, never queried per component.

## 5. Global conventions

Every phase follows these. An agent that deviates says so in its report.

### 5.1 API access

- All calls go through the generated client. Hand-written `fetch` calls are a review failure.
- `schema.d.ts` is generated by `pnpm gen:api` from the backend's `openapi.yaml` and committed, so CI and the agents build without the backend running.
- Query keys come from `queryKeys.ts` only. Every space-scoped key starts with the space id, so switching spaces cannot show stale data from another space: `['space', spaceId, 'wallets', filters]`.
- Lists use `useInfiniteQuery` with `nextCursor` as the page param, matching the backend's cursor pagination.
- Defaults: `staleTime` 30 s for lists, 5 min for static catalogs (currencies, investment types, card presets), `retry: 1` with no retry on 4xx, and `refetchOnWindowFocus` on for money screens only.
- The service worker caches the app shell and static assets. API responses are never cached by the service worker.

### 5.2 Money

- Money arrives and departs as a **string** with a separate `currency`. It is never put through `Number()`, `parseFloat`, `+` or `toFixed`.
- `shared/money` exposes `toDecimal(str)`, `format(amount, currency, opts)`, `minorUnits(currency)` and `parseInput(str, currency)`. Formatting uses `Intl.NumberFormat` with the currency's minor units (IDR 0, USD 2).
- All money renders through `<Amount value currency />`, which applies hide-amounts, sign colouring and the tabular-numeral font feature.
- The mini-calculator keyboard evaluates with `decimal.js-light` and emits a plain string.
- The client never recomputes a total the API already returns. Sums, conversions and P/L come from the server.

### 5.3 Errors

- `shared/api/errors.ts` normalises the backend envelope into `AppError { code, message, details, requestId, status }`.
- A `code`-to-message map gives user-facing copy for the codes in the backend's Appendix B. An unmapped code falls back to the server `message`, then to a generic line. Never show a raw code to the user, but always log the `requestId`.
- `VALIDATION_FAILED` details map onto React Hook Form field errors by field name.
- Presentation: inline under the field for validation; a toast for a failed action; a full-screen error state with a retry for a failed page load. A 401 never renders an error, it routes to `/login`.
- Every route has an error boundary. The root boundary catches render crashes and offers a reload.

### 5.4 Auth

- The access token lives in a module variable. On boot the app calls `POST /auth/refresh`; success restores the session, failure routes to `/login`.
- A single-flight promise guards the refresh, so ten parallel 401s cause one refresh.
- Protected routes `beforeLoad` check the session and redirect, carrying the attempted path so the user lands back there.
- The app-lock gate is a UI overlay only, shown on boot and on return to the tab when enabled. It is explicitly not a security boundary.

### 5.5 Routing and URL state

- Routes are typed. Filters, period presets and search text are typed search params validated with Zod, so a shared or reloaded URL restores the view exactly.
- Space-scoped routes live under `/s/$spaceId/...`, mirroring the API shape.
- Sheets are route-driven where the content is linkable (`/s/$spaceId/wallets/$walletId/edit`) and local state where they are not (a colour picker).
- Every route is lazily loaded. Charts, the investment forms and the settings tree are separate chunks.

### 5.6 Design and theming

- Colour, radius, spacing, shadow and motion values come from the tokens in Appendix B. A raw hex value in a component is a review failure, except for user-chosen wallet card colours.
- Both themes ship. `prefers-color-scheme` is the default, with an override in `localStorage` applied before first paint by an inline script, so the page never flashes.
- Motion uses springs, not duration easing, for anything that moves under a finger. All of it respects `prefers-reduced-motion`.
- Data motion (addendum F11, D-F15): count-up about 700 ms, line draw about 900 ms, bars grow with a 40 ms stagger, donut slices sweep in. Use CSS and `requestAnimationFrame`, no animation library, and instant under reduced motion. **One hero number per screen region** counts up (`<Amount animate>`), never every row. Count-ups interpolate with Decimal, end on the exact server string, and never run or render a digit while amounts are hidden.
- Every screen defines three states besides the happy path: loading (skeletons shaped like the real content, never a spinner on a full page), empty (an illustration-free card with one action, as on the Goals screen), and error.

### 5.7 Accessibility

Keyboard reachable throughout, visible focus rings, labelled form fields, 44 px minimum touch targets, `aria-live` for toasts, and a contrast ratio of at least 4.5:1 on body text in both themes. Charts carry a text summary or a data table for screen readers.

### 5.8 Testing (minimum per feature)

- **Unit:** every pure helper in `shared/money`, `shared/period` and any feature-level calculation.
- **Component:** each form's validation rules and each list's empty, loading and error states, against MSW handlers.
- **End-to-end:** one Playwright flow per feature covering the main path, one validation failure, and one server-error path.
- MSW handlers are typed from `schema.d.ts`, so a contract change breaks the tests rather than production.

### 5.9 Performance budget (enforced in CI)

| Metric | Budget |
| --- | --- |
| Initial JS, gzipped | ≤ 150 KB |
| Any lazy route chunk, gzipped | ≤ 60 KB |
| CSS, gzipped | ≤ 25 KB |
| LCP, mid-range Android on 4G | ≤ 1.5 s |
| Lighthouse performance and accessibility | ≥ 90 |

CI fails the build when a budget is exceeded. Raising a budget is a decision recorded in Section 2, not a commit.

### 5.10 Definition of Done (per phase)

1. All tasks implemented and the phase's acceptance criteria demonstrably met.
2. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` pass.
3. `pnpm build` passes the bundle budget check.
4. Every new screen handles loading, empty and error states, and works at 360 px and 1280 px.
5. Both themes checked. Keyboard navigation checked.
6. The agent's report lists files changed, routes added, API endpoints consumed, test results and deviations.

## 6. Screen and route map

Five tabs on mobile, matching the reference: Home, History, Wallets, Assets, and a central add button. `{s}` stands for `/s/$spaceId`.

| Route | Screen | Backend endpoints | Phase |
| --- | --- | --- | --- |
| `/login`, `/register` | Auth | `POST /auth/login`, `/auth/register` | F2 |
| `/forgot-password`, `/reset-password` | Password reset | `POST /auth/forgot-password`, `/auth/reset-password` | F2 |
| `{s}` | Home dashboard | `dashboard/overview`, `category-breakdown`, `analytics`, `calendar` | F9 |
| `{s}/history` | Transaction list, search, day groups | `GET transactions`, `transactions/daily-summary` | F5 |
| `{s}/history/filters` | Filter sheet | `GET categories`, `GET wallets` | F5 |
| `{s}/wallets` | Wallet cards, total | `GET wallets` | F4 |
| `{s}/wallets/$id` | Wallet detail, its transactions | `GET wallets/{id}`, `GET transactions?walletIds=` | F4 |
| `{s}/wallets/$id/edit` | Edit sheet, balance adjust, delete | `PATCH wallets/{id}`, `PUT wallets/{id}/balance` | F4 |
| `{s}/wallets/$id/card` | Card colour editor: solid, gradient, template | `PATCH wallets/{id}`, `GET wallet-card-presets`, `/templates` | F4 |
| `{s}/assets` | Net worth, cash, investments, fixed, owed, debt | `net-worth/summary`, `net-worth/history` | F8 |
| `{s}/investments` | Investment list with valuation | `GET investments?include=shared` | F7 |
| `{s}/investments/new` | Type-driven create form | `GET investment-types`, `POST investments`, market search | F7 |
| `{s}/investments/$id` | Detail, buy/sell, participants | `GET investments/{id}`, `POST transfers`, participants | F7 |
| `{s}/goals` | Goals list and progress | `GET goals` | F8 |
| `{s}/goals/new`, `/$id` | Goal form, allocations | `POST goals`, `PUT goals/{id}/allocations/{walletId}` | F8 |
| `{s}/categories` | Expense and income categories, budgets | `GET categories?includeStats`, CRUD, order | F6 |
| `{s}/transactions/new` | Add sheet: expense, income, transfer | `POST transactions`, `POST transfers` | F5 |
| `/settings` | Settings index | — | F3 |
| `/settings/space` | Space settings, members, invitation | `PATCH spaces/{id}`, members, invitations | F3 |
| `/settings/profile` | Profile, timezone, password | `PATCH /me`, `POST /auth/change-password` | F3 |
| `/settings/security` | App lock, hide amounts | `/me/preferences`, `/me/app-lock` | F3 |
| `/settings/currency` | Base currency, auto conversion, manual rates | `GET /currencies`, manual rates | F3 |
| `/invitations/$code` | Accept a space invitation | `POST /invitations/{code}/accept` | F3 |
| `/invitations/shared` | Shared-investment invitation inbox | `/me/shared-investment-invitations` | F7 |

### 6.1 Shared components built once

`AmountDisplay`, `MoneyInput` with the mini-calculator, `PeriodPicker`, `CurrencySelect`, `EmojiPicker`, `ColorPicker`, `WalletCard`, `CategoryChip`, `TransactionRow`, `DayGroupHeader`, `SheetShell`, `ConfirmDialog`, `SegmentedControl`, `EmptyState`, `StatCard`, `ProgressRing`. Each is built in the earliest phase that needs it and reused afterwards, never reimplemented.

## 7. Roadmap and phase tracker

&#91;embedded content: frontend phase dependencies · 11 phases, 1 parallel branch\]

F0 and F1 need no backend at all, so you can start today. From F3 onward each phase needs its backend phase Done, and all of those except P18 and P19 already are.

| Phase | Title | Depends on | Backend needed | Status |
| --- | --- | --- | --- | --- |
| F0 | WSL environment, repository and tooling | — | — | Done (local e2e skipped: Chromium system libs not installed; CI runs it. Bundle check is `scripts/check-bundle.mjs` instead of size-limit) |
| F1 | Design system, app shell and primitives | F0 | — | Done (local e2e skipped, CI runs it; mobile sheet focus trap and drag-dismiss verified only by e2e, not jsdom) |
| F2 | API client, auth and session | F0, F1 | P2 | Done (local e2e skipped, CI runs it; `openapi-react-query` not used, plain `openapi-fetch` + TanStack Query) |
| F3 | Spaces, settings, preferences and app lock | F2 | P3, P4, P5 | Done (local e2e skipped, CI runs it; Goals and Categories rows in Settings arrive with F8 and F6) |
| F4 | Wallets and the card style editor | F3 | P7 | Done (local e2e skipped, CI runs it; PeriodPicker built here, not in F5; reorder uses up/down buttons; Transfer action added in F5) |
| F6 | Categories and budgets | F3 | P6, P8 | Done (local e2e skipped, CI runs it; built before F5 as the dependency table orders it; reorder uses up/down buttons) |
| F5 | Transactions, filters and transfers | F4, F6 | P8, P9 | Done (local e2e skipped, CI runs it; transfer to an investment is stubbed out until F7) |
| F7 | Investments | F5 | P10 to P14 | Done (local e2e skipped, CI runs it; detail has no related-transactions list: the transactions API has no investment filter) |
| F8 | Assets, net worth and goals | F7 | P15, P16 | Done (local e2e skipped, CI runs it; the net-worth chart arrives with F9) |
| F9 | Dashboard and charts | F5, F8 | P17 | Done (local e2e skipped, CI runs it; the Home account card is gone, sign-out is on Profile) |
| F10 | PWA, hardening and deployment | all | P19 | Review (code complete and tested; unmeasured here: Lighthouse >= 90, Android install and the seeded-backend full flow; D-F13 host still undecided; local e2e skipped, CI runs it) |

**Milestones.** MF1 Foundation (F0 to F2), MF2 Money core (F3 to F6), MF3 Investments and net worth (F7, F8), MF4 Production (F9, F10).

## 8. Phases

### F0: WSL environment, repository and tooling

**Goal:** A Vite app that builds, lints, tests and hot-reloads inside WSL, in its own GitHub repo, with CI and the bundle budget already wired. No product screens. **Depends on:** nothing · **Size:** Small-Medium · **Who:** steps marked **(you)** are manual; **(agent)** steps go to Claude Code once Node is installed.

| ID | Task | Who | Detail |
| --- | --- | --- | --- |
| F0-T01 | Install Node inside WSL | **(you)** | `curl -fsSL https://fnm.vercel.app/install \| bash`, then `fnm install 22 && fnm use 22`. Confirm `node -v` reports v22.x. Do **not** use a Windows-side Node: a Windows `node.exe` on the PATH silently shadows the Linux one and breaks native binaries. |
| F0-T02 | Enable pnpm | **(you)** | `corepack enable && corepack prepare pnpm@latest --activate`. Confirm with `pnpm -v`. |
| F0-T03 | Create the repo | **(you)** | An empty GitHub repo, no README. Reuse the WSL SSH key from backend P0-T07. |
| F0-T04 | Scaffold | **(agent)** | In `~/projects/asset-web` (**not** `/mnt/c/...`): `pnpm create vite . --template react-ts`, strict `tsconfig` (`strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`), `@/*` path alias, `.nvmrc` with `22`, `engines` and `packageManager` pinned in `package.json`. |
| F0-T05 | Line endings | **(agent)** | `.gitattributes` with `* text=auto eol=lf`, and `git config core.autocrlf input`. CRLF breaks Biome and shell scripts in WSL. |
| F0-T06 | Biome | **(agent)** | `biome.json`: formatter plus recommended rules, plus `noRestrictedGlobals` for `parseFloat`, and a rule banning raw hex colours outside `styles/`. Scripts: `lint`, `format`. |
| F0-T07 | Tailwind v4 | **(agent)** | `@tailwindcss/vite` plugin, `styles/tokens.css` and `globals.css` imported from `main.tsx`. Tokens stay empty until F1. |
| F0-T08 | Vite config | **(agent)** | `server.host: true` and `server.port: 5173`; `server.proxy['/api'] -> http://localhost:8080` with `changeOrigin: false` so cookies keep their host; `rollup-plugin-visualizer` behind an `ANALYZE` env var; manual chunks for `react`, `router+query` and `charts`. |
| F0-T09 | Test harness | **(agent)** | Vitest with jsdom plus Testing Library; MSW with a `server.ts` for Node and a `browser.ts` for dev; Playwright config pinned to Chromium headless. Note in the README: run `pnpm exec playwright install --with-deps chromium` inside WSL. |
| F0-T10 | CI | **(agent)** | GitHub Actions on push and PR: pnpm cache, `lint`, `typecheck`, `test`, `build`, then a `size-limit` check against the Section 5.9 budgets. The job fails on a budget breach. |
| F0-T11 | Verify | **(you)** | `pnpm dev`, open `http://localhost:5173` from the Windows browser, edit a file and confirm HMR lands in under a second. Confirm `echo $PWD` does not start with `/mnt/c`. |

**Acceptance criteria**

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass locally and in CI.
- The dev server is reachable from the Windows browser and HMR works within about a second.
- The project is on the Linux filesystem and the first commit is pushed.
- An artificial 200 KB import fails the CI budget check, proving the gate works.

**WSL note:** if HMR stops firing, raise the watcher limit with `echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p`.

---

### F1: Design system, app shell and primitives

**Goal:** The visual language and every reusable primitive, demonstrated on a component gallery route. No API calls yet. **Depends on:** F0 · **Size:** Medium-Large

**Out of scope:** any data fetching, any real screen.

| ID | Task | Technical approach | Pri | Size |
| --- | --- | --- | --- | --- |
| F1-T01 | Tokens | `styles/tokens.css` per Appendix B: colour, radius, spacing, shadow, motion. Dark values on `:root`, light under `[data-theme="light"]`, mapped into Tailwind v4 via `@theme` | Critical | M |
| F1-T02 | Theme provider | `ThemeContext` with light / dark / system; an inline script in `index.html` applies the stored choice before first paint, so there is no flash | Critical | S |
| F1-T03 | Typography and layout | System font stack with Inter variable self-hosted as `font-display: swap`; a type scale; `.tabular` utility using `font-variant-numeric: tabular-nums` for all money | High | S |
| F1-T04 | Core primitives | Button (4 variants), Input, Field, Select, Switch, SegmentedControl, Chip, Card, Skeleton, EmptyState, Toast — shadcn files copied in and restyled to tokens | Critical | L |
| F1-T05 | SheetShell | Vaul wrapper: grabber, close button, safe-area padding, scroll lock, a sticky footer action. Above 768 px it renders a Radix Dialog instead, with the same API | Critical | M |
| F1-T06 | App shell | Mobile: floating pill tab bar with 4 tabs plus a centre add button, `backdrop-filter`, safe-area inset. Desktop: left sidebar. One `<AppShell>` picking the layout from a single media query | Critical | M |
| F1-T07 | Motion | `LazyMotion` with `domAnimation` at the root; spring presets (`sheet`, `press`, `list`); a `useReducedMotion` guard that collapses every spring to an instant change | High | S |
| F1-T08 | Money primitives | `shared/money` helpers; `<Amount>` with hide-amounts blur and sign colour; `<MoneyInput>` with the mini-calculator keypad (`+ − × ÷`, evaluated with `decimal.js-light`) and a standard numeric mode | Critical | L |
| F1-T09 | Gallery route | `/_gallery`, dev-only, rendering every primitive in both themes and at both breakpoints. This is what the agent screenshots to prove the phase | High | S |
| F1-T10 | Tests | Unit tests for money helpers and calculator evaluation; component tests for Sheet open/close and Amount hiding | Critical | M |

**Acceptance criteria**

- `0.1 + 0.2` through the calculator yields exactly `0.3`; `1.005` at 2 minor units rounds as the backend would display it.
- A sheet drags to dismiss on touch, closes on Escape, traps focus, and becomes a centred dialog at 1280 px.
- Toggling the theme repaints with no flash, and a reload keeps the choice.
- With hide-amounts on, no money string is present in the DOM, not merely blurred by CSS.
- The gallery renders correctly at 360 px and 1280 px in both themes.

---

### F2: API client, auth and session

**Goal:** Typed API access, a working login and registration flow, in-memory tokens with single-flight refresh, and protected routing. **Depends on:** F0, F1 · backend P2 · **Size:** Medium-Large

| ID | Task | Technical approach | Pri | Size |
| --- | --- | --- | --- | --- |
| F2-T01 | Resolve D-F05 | Check whether `swag` v2 emits usable OpenAPI 3.1. If not, add `swagger2openapi` to the `gen:api` script. Record the outcome in Section 2 | Critical | S |
| F2-T02 | Generate types | `pnpm gen:api` running `openapi-typescript` over the backend's `openapi.yaml` into `shared/api/schema.d.ts`, committed. A CI step regenerates and fails on a diff | Critical | S |
| F2-T03 | Client + middleware | `openapi-fetch` with `baseUrl: '/api/v1'` and `credentials: 'include'`; a request middleware attaching the bearer token; a response middleware normalising the error envelope into `AppError` | Critical | M |
| F2-T04 | Token store and refresh | Module-scoped token; single-flight refresh promise; retry the original request once on 401; on refresh failure clear the session and redirect to `/login` | Critical | M |
| F2-T05 | Query client | `QueryClient` defaults from Section 5.1; `queryKeys.ts` factory; a global `onError` that routes 401 and toasts everything else | Critical | S |
| F2-T06 | Auth screens | Login, register (sending `Intl.DateTimeFormat().resolvedOptions().timeZone` as `timezone`), forgot-password, reset-password. React Hook Form + Zod, server field errors mapped in | Critical | M |
| F2-T07 | Session provider | Boot sequence: attempt refresh, then `GET /me`; a splash while pending; `SessionContext` exposing user and status | Critical | M |
| F2-T08 | Route guards | `beforeLoad` redirecting unauthenticated users to `/login?redirect=`, and authenticated users away from `/login` | Critical | S |
| F2-T09 | Error copy map | `errors.ts` mapping the backend's Appendix B codes to user-facing sentences | High | S |
| F2-T10 | Tests | MSW-backed component tests for each form; a Playwright flow for register → reload → still signed in → logout; a unit test proving ten parallel 401s trigger one refresh | Critical | M |

**Acceptance criteria**

- Registering lands on the dashboard with a space already active.
- A hard reload keeps the session without a visible flash of the login screen.
- `INVALID_CREDENTIALS` renders a friendly sentence, not a code.
- The access token appears in no storage API; only the `rt` cookie persists.
- Ten concurrent requests after an expired token produce exactly one `POST /auth/refresh` in the network log.

### F3: Spaces, settings, preferences and app lock

**Goal:** The space context every later screen depends on, the settings tree, and the privacy features. **Depends on:** F2 · backend P3, P4, P5 · **Size:** Medium-Large

| ID | Task | Technical approach | Pri | Size |
| --- | --- | --- | --- | --- |
| F3-T01 | SpaceContext | Load `GET /spaces`, resolve the active space from `lastActiveSpaceId`, expose id, base currency, tracking mode and my role. Switching calls `POST /spaces/{id}/activate` and resets the query cache for the old space | Critical | M |
| F3-T02 | Space switcher | Avatar menu in the header listing spaces with role and member count, plus a create-space action | High | M |
| F3-T03 | Settings index | The grouped list from the reference: Profile, Space, Goals, Categories, App lock, Hide amounts, Keyboard, Currency, plus an app version line. Items the backend does not support are absent, not disabled | High | S |
| F3-T04 | Space settings | Name, emoji and colour avatar, base currency, auto FX toggle, tracking mode. Owner-only fields render read-only for members, matching the 403 the API would return | High | M |
| F3-T05 | Members and invitations | Member list, remove, leave; generate, copy and revoke an invitation code with its 7-day expiry and the 5-member limit shown; `/invitations/$code` accept screen handling `INVITATION_EXPIRED` and `ALREADY_A_MEMBER` | High | M |
| F3-T06 | Profile and password | `PATCH /me` for name and timezone (a searchable IANA list defaulting to the browser zone); change-password form that re-authenticates after the server revokes other sessions | High | M |
| F3-T07 | Preferences | Hide amounts and keyboard type through `PreferencesContext`, applied optimistically with rollback on failure | High | S |
| F3-T08 | App lock | Enable with PIN plus password; a numeric PIN pad; the gate overlay on boot and on tab refocus; lockout countdown driven by `retryAfter` from `APP_LOCK_TEMPORARILY_LOCKED`. A visible note that this guards the screen, not the data | High | M |
| F3-T09 | Currency settings | Supported currency list, manual FX rate editor when auto conversion is off, and a warnings strip wherever the API returns `warnings[]` for a missing rate | Medium | M |
| F3-T10 | Tests | Component tests for the owner-versus-member field matrix and the PIN lockout; Playwright flow for switching spaces and confirming the wallet list changes | Critical | M |

**Acceptance criteria**

- Switching spaces shows no data from the previous space at any moment, including during loading.
- A member sees owner-only settings as read-only and never triggers a 403.
- With hide-amounts on, every `<Amount>` across the app is masked, and the eye toggle on Home reveals them for the session only.
- Six wrong PINs show a countdown taken from the server, not a client-side timer.

---

### F4: Wallets and the card style editor

**Goal:** The wallet list, detail, CRUD, and the solid / gradient / template card editor from the reference screens. **Depends on:** F3 · backend P7 · **Size:** Medium-Large

| ID | Task | Technical approach | Pri | Size |
| --- | --- | --- | --- | --- |
| F4-T01 | WalletCard | The card from `bank_list`: icon, name, balance, type label, and a `card_style` renderer covering solid, 8-direction gradient (mapped to a CSS `linear-gradient` angle) and template. Contrast-aware text colour computed from the background luminance | Critical | M |
| F4-T02 | Wallet list | Favourites first, then sort order; the converted total header with its warnings; drag to reorder calling `PUT wallets/order`, optimistic with rollback | Critical | M |
| F4-T03 | Create wallet | Type, name, emoji, currency, optional initial balance, card style. Currency is locked after transactions exist, surfacing `WALLET_CURRENCY_LOCKED` as a disabled field with a reason | Critical | M |
| F4-T04 | Card style editor | The three-tab sheet: solid palette with custom hex and eyedropper, gradient with two colour slots, swap, 8 directions and presets, and the template grid. Live preview on the real card. Applies on Apply only | High | L |
| F4-T05 | Wallet detail | Balance header, Add balance and Transfer actions, the wallet's transactions with a period picker, and the overflow menu: edit, favourite, delete | Critical | M |
| F4-T06 | Balance adjust | `PUT wallets/{id}/balance` with before and after shown, and the explanation that the difference is recorded as an adjustment | High | S |
| F4-T07 | Top-up | `POST wallets/{id}/top-up` from the detail screen | High | S |
| F4-T08 | Delete | Confirm dialog; a non-zero balance requires the explicit force confirmation, with `WALLET_HAS_BALANCE` explained in plain words | High | S |
| F4-T09 | Tests | Component tests for gradient direction mapping and contrast; Playwright flow: create wallet with initial balance → adjust → confirm the adjustment appears in history → delete | Critical | M |

**Acceptance criteria**

- A gradient card with direction `SE` renders the same visual angle as the reference screenshot.
- A card colour applies only after Apply; dismissing the sheet discards the change.
- Reordering survives a reload, and a failed reorder snaps back with a toast.
- Creating a wallet with an initial balance shows the opening-balance transaction in its history.

---

### F5: Transactions, filters and transfers

**Goal:** The history screen, the add sheet, and transfers. This is the app's most-used surface. **Depends on:** F4, F6 · backend P8, P9 · **Size:** Large

| ID | Task | Technical approach | Pri | Size |
| --- | --- | --- | --- | --- |
| F5-T01 | PeriodPicker | The preset list from the filter screen plus a custom range, stored as a typed search param and reused by every period-aware screen | Critical | M |
| F5-T02 | History list | `useInfiniteQuery` on `GET transactions` with cursor paging, day group headers carrying the day's in and out totals, TanStack Virtual for the rows, and a sticky period header | Critical | L |
| F5-T03 | Search | Debounced `q` param bound to the URL, with an empty-result state that names what was searched | High | S |
| F5-T04 | Filter sheet | Date presets, category chips and wallet chips as multi-select, Apply and Clear, with an active-filter count badge on the trigger | Critical | M |
| F5-T05 | Add sheet | A segmented Expense / Income / Transfer sheet: amount first with the calculator keypad, then wallet, category, date and note. Category options filtered to the matching type, which prevents `CATEGORY_TYPE_MISMATCH` before the request | Critical | L |
| F5-T06 | Edit and delete | Reuses the add sheet; adjustment and opening-balance rows expose only the note field, and transfers and buy/sell route to their own editors, matching `USE_SPECIFIC_ENDPOINT` | High | M |
| F5-T07 | Transfer form | From and to selectors over wallets (with the investment option stubbed until F7), amount, and a `toAmount` field that appears only when currencies differ, showing the implied rate | Critical | M |
| F5-T08 | Cache invalidation | A shared `invalidateMoney(spaceId)` helper invalidating wallets, transactions, net worth, dashboard and goals in one call, used by every money mutation | Critical | S |
| F5-T09 | Optimistic add | Insert the new row at the top of the current day group with a pending style; roll back and toast on failure | Medium | M |
| F5-T10 | Tests | Unit tests for period-to-param round-trips; Playwright flows for add expense, filter by category, cross-currency transfer, and edit-then-verify both balances | Critical | M |

**Acceptance criteria**

- A filtered, searched view survives a copy-paste of the URL into a new tab.
- Scrolling 500 transactions stays smooth, with no layout shift as pages load.
- A cross-currency transfer requires `toAmount` and shows the resulting rate before submitting.
- After any add, edit or delete, the wallet balance, history and net worth all reflect it without a manual reload.

### F6: Categories and budgets

**Goal:** Category management with budgets and usage stats. Small, and can run in parallel with F4. **Depends on:** F3 · backend P6, P8 · **Size:** Small-Medium

| ID | Task | Technical approach | Pri | Size |
| --- | --- | --- | --- | --- |
| F6-T01 | Category list | Expense / Income segmented tabs, each row showing icon, name and either the budget line or spend-to-date, as in `expense_income_category` | Critical | M |
| F6-T02 | Create and edit | Emoji picker, colour picker, name, and a budget field shown only for expense types, which keeps `BUDGET_NOT_ALLOWED` unreachable | Critical | M |
| F6-T03 | Suggestions | `GET /categories/suggestions` rendered as tappable chips that prefill the form | Medium | S |
| F6-T04 | Reorder and delete | Drag to reorder calling `PUT categories/order`; delete explains that past transactions keep the category | High | S |
| F6-T05 | Budget progress | A progress bar from `budgetUsedPct` with an over-budget state; `includeStats=true` requested only where stats are displayed | High | S |
| F6-T06 | Picker component | `CategoryPicker`, consumed by F5's add sheet and F9's breakdown, filtered by transaction type | Critical | S |
| F6-T07 | Tests | Component tests for the type-filtered picker and the duplicate-name error; Playwright flow: create a category, set a budget, spend against it, see the bar move | High | M |

**Acceptance criteria**

- A new space shows its 7 seeded expense and 4 income categories without any client-side seeding.
- A duplicate name surfaces `CATEGORY_NAME_TAKEN` as an inline field error.
- The budget bar matches `budgetUsedPct` exactly; it is never recomputed on the client.

---

### F7: Investments

**Goal:** The five investment types with their type-specific forms, live-price display, buy and sell, and shared ownership. **Depends on:** F5 · backend P10 to P14 · **Size:** Large (consider splitting into F7a forms and valuation, F7b buy/sell and sharing)

| ID | Task | Technical approach | Pri | Size |
| --- | --- | --- | --- | --- |
| F7-T01 | Type metadata | Fetch `GET /investment-types` and drive the form from it, so a new backend type needs no frontend change. A Zod discriminated union on `assetType` validates the payload | Critical | M |
| F7-T02 | Create form | The Auto / Manual segmented control plus the per-type fields from the reference screens: crypto (coin, network, staked), Indonesian stock (lots, with derived shares shown read-only), US stock (exchange, platform, USD/IDR rate), mutual fund (NAV fields), ETF (expense ratio, asset class) | Critical | L |
| F7-T03 | Market search | Debounced `GET /market/crypto/search` and `/market/stocks/search`, returning an instrument id bound to the form. Auto mode requires a chosen instrument; `AUTO_PRICE_NOT_SUPPORTED` disables the Auto tab for Indonesian stocks and mutual funds with a short reason | Critical | M |
| F7-T04 | Investment list | Grouped by asset type, each row showing value, cost and P/L with sign colour, plus the portfolio summary header. A stale-price badge from `isStale`, with `priceAsOf` on hover or tap | Critical | M |
| F7-T05 | Detail screen | Valuation breakdown, position, realized P/L, price source, a manual refresh button rate-limited to once a minute, and its related transactions | High | M |
| F7-T06 | Buy and sell | Sheets over `POST /transfers` with the investment source or destination; quantity, unit price and fee, with the resulting position previewed before submit. `INSUFFICIENT_QUANTITY` and `POSITION_CHANGED_SINCE` get plain-language messages, the latter offering a refresh | Critical | L |
| F7-T07 | Funding on create | The optional initial-position funding wallet, matching the backend's `funding` field | High | S |
| F7-T08 | Sharing | Participant editor as a full-replacement list with a live percentage total that blocks submit until it is exactly 100.00%; email and name-only participant kinds; the invitation inbox with accept (choosing a space) and decline | High | L |
| F7-T09 | Shared-in display | Items flagged `SHARED_IN` render read-only with a share badge, showing my share and the total side by side | High | M |
| F7-T10 | Account seam | Leave a `accountId` field and a grouping slot unused but typed, so backend P18 becomes a display change rather than a rewrite | Medium | S |
| F7-T11 | Tests | Unit tests for the share-total validator; component tests for each type's required fields; Playwright flows for create crypto with auto price, buy, sell, and share 50/50 | Critical | L |

**Acceptance criteria**

- Entering 2 lots of an Indonesian stock displays 200 shares, derived and read-only.
- Auto mode cannot be submitted without a resolved instrument id.
- A participant list summing to 99.99% cannot be submitted, and the running total is visible while editing.
- A shared-in investment offers no edit affordance anywhere in the UI.
- A provider outage shows the last known price with a stale badge rather than an error.

---

### F8: Assets, net worth and goals

**Goal:** The asset page, manual assets with settlements, and savings goals. **Depends on:** F7 · backend P15, P16 · **Size:** Medium-Large

| ID | Task | Technical approach | Pri | Size |
| --- | --- | --- | --- | --- |
| F8-T01 | Asset page | The collapsible sections from `asset_page`: Cash, Investments, Fixed assets, Money owed, Debt, each with a total and an add action. `CASH_ONLY` tracking mode hides all but Cash | Critical | M |
| F8-T02 | Net worth header | Current net worth with the period change badge, above the history chart added in F9 | High | S |
| F8-T03 | Manual assets | Create and edit for fixed assets, receivables and liabilities, with counterparty, due date and estimated annual change where the kind allows | High | M |
| F8-T04 | Settlements | The transfer action on owed and debt cards; amount capped at the outstanding value, with `SETTLEMENT_EXCEEDS_BALANCE` prevented client-side and still handled if returned | High | M |
| F8-T05 | Goals list | Progress ring, target, target date, and required monthly; the empty state from `goal` with its single Add goal action | High | M |
| F8-T06 | Goal form | Name, icon, target amount, target date, and the optional initial reserve with the wallet's available balance shown live | High | M |
| F8-T07 | Allocations | Per-wallet reserve editor validating against available balance; `overReserved` surfaces as a warning on both the goal and the wallet, never as an error | High | M |
| F8-T08 | Wallet integration | Add reserved and available lines to the F4 wallet detail | Medium | S |
| F8-T09 | Tests | Component tests for the available-balance guard and the over-reserved warning; Playwright flows for a debt settlement and a goal reaching its target | High | M |

**Acceptance criteria**

- A wallet of 134.26 with 100 reserved shows 34.26 available in both the goal form and the wallet detail.
- Settling 200 against a 500 debt leaves 300 outstanding and reduces the wallet, both visible without a reload.
- A goal reaching its target shows an achieved state, and dropping below clears it.
- `CASH_ONLY` mode hides investments, fixed assets, owed and debt everywhere, not only on the asset page.

### F9: Dashboard and charts

**Goal:** The home screen and every chart in the app, drawn as our own SVG. **Depends on:** F5, F8 · backend P17 · **Size:** Medium

| ID | Task | Technical approach | Pri | Size |
| --- | --- | --- | --- | --- |
| F9-T01 | Chart primitives | `LineChart`, `BarChart` and `DonutChart` in `shared/charts`: `d3-scale` and `d3-shape` for geometry, our own SVG for rendering, tokens for colour, `ResizeObserver` for width, and a `<table>` fallback for screen readers. One lazy chunk | Critical | L |
| F9-T02 | Overview card | Period expenses and income with the percentage change against the previous period; a null previous value shows a dash, not 0% | Critical | S |
| F9-T03 | Category breakdown | Donut with a centre transaction count, a legend, and an uncategorised slice; tapping a slice navigates to history filtered by that category | High | M |
| F9-T04 | Analytics | Bar chart over the backend's buckets, labelled exactly as returned (`1–7 Nov` through `29–30 Nov`), with income and expense side by side and the comparison lines below | High | M |
| F9-T05 | Calendar | Month grid with per-day net and a count dot, arrows for month navigation, and today highlighted, as in `home` | High | M |
| F9-T06 | Net worth chart | Line chart over `net-worth/history` with 1M / 3M / 6M / 1Y / ALL range tabs, the live point marked, and the change badge | Critical | M |
| F9-T07 | Quick actions | The Import, Insight, Goal and Consult row: only Goal is wired; the rest are absent in v1 rather than shown disabled | Medium | S |
| F9-T08 | Tests | Unit tests for scale and path generation against fixed fixtures; component tests for the empty-data state of each chart; a visual check at 360 px | High | M |

**Acceptance criteria**

- All three chart types render from a fixture with no layout shift and no console warning.
- The charts chunk is loaded only on routes that show a chart, verified in the network panel.
- A space with one day of data renders a sensible single-point net worth chart rather than an empty box.
- Chart colours come from tokens and remain legible in both themes.

---

### F10: PWA, hardening and deployment

**Goal:** Production readiness: installable, fast, accessible, observable, deployed. **Depends on:** all · **Size:** Medium

| ID | Task | Technical approach | Pri | Size |
| --- | --- | --- | --- | --- |
| F10-T01 | PWA | `vite-plugin-pwa` with an app-shell precache, a manifest with maskable icons, an update prompt on a new version, and an explicit rule that API responses are never cached | High | M |
| F10-T02 | Offline behaviour | An offline banner driven by `navigator.onLine` plus failed requests; read-only screens serve from the Query cache; writes are blocked with a clear message rather than queued | High | S |
| F10-T03 | Performance pass | Bundle analysis, dropping anything accidental; route-level prefetch on link hover and tab focus; image and font audit; confirm every Section 5.9 budget | Critical | M |
| F10-T04 | Accessibility pass | Axe run on every route, keyboard walkthrough of each sheet, focus-return checks, and a contrast audit of both themes | Critical | M |
| F10-T05 | Error reporting | Sentry behind an env flag, lazily loaded, with the `requestId` attached to every API error and tokens scrubbed (D-F12) | Medium | S |
| F10-T06 | Deployment | Static host on the same site as the API; SPA fallback to `index.html`; immutable hashed assets with a no-cache `index.html`; environment-specific API base URL (D-F13) | Critical | M |
| F10-T07 | Security headers | CSP without `unsafe-inline` (the theme boot script gets a nonce or hash), `Referrer-Policy`, `X-Content-Type-Options`, and a frame-ancestors denial | High | S |
| F10-T08 | Full-flow test | A Playwright suite running register → create wallet → add transactions → create investment → set a goal → read the dashboard, against a seeded backend | Critical | M |
| F10-T09 | README and runbook | Setup from a clean WSL install, the scripts, env vars, the deployment steps, and how to regenerate the API types | High | S |

**Acceptance criteria**

- Lighthouse scores 90 or above for performance, accessibility and best practices on Home and History, throttled as mobile.
- The app installs on Android and launches offline to a readable cached shell.
- The full-flow Playwright suite passes against a freshly seeded backend.
- A new deployment prompts open tabs to update rather than breaking on a stale chunk.

## 9. Risks, technical debt and open questions

| ID | Type | Description | Mitigation |
| --- | --- | --- | --- |
| RF-01 | Risk | The Swagger 2.0 versus OpenAPI 3.x mismatch blocks type generation | Resolve D-F05 in F2-T01. The fallback, `swagger2openapi` in the build, needs no backend change |
| RF-02 | Risk | F7 (investments) is large enough to overflow one agent session | Split into F7a (types, forms, valuation, list) and F7b (buy/sell, sharing) at the first sign of strain |
| RF-03 | Risk | The bundle budget tightens as features land, and F7 plus F9 are the heaviest | Route-level splitting from F0; measure every phase, not only at F10 |
| RF-04 | Risk | Backend P18 (investment accounts) lands after F7, forcing a rework of the investment list | F7-T10 leaves the grouping seam typed but unused |
| RF-05 | Risk | The card style editor is visually fussy and easy to get subtly wrong | Build the gradient direction mapping as a tested pure function, not inline CSS |
| RF-06 | Risk | WSL file watching fails silently on large `node_modules` | Documented watcher-limit fix in F0; keep the project off `/mnt/c` |
| TDF-01 | Debt | No offline writes; the app is read-only when disconnected | Acceptable for v1. Revisit only if usage shows a need |
| TDF-02 | Debt | No design-system documentation beyond the gallery route | The gallery is the reference. Add Storybook only if a second developer joins |
| TDF-03 | Debt | No visual regression testing | Playwright screenshots on the gallery route would cover it cheaply; defer to post-v1 |
| TDF-04 | Debt | Query cache is memory-only, so every cold start refetches | Acceptable. Persisting the cache would need encryption for financial data |
| QF-01 | Open question | Does the API expose a transaction-level endpoint for a single investment's price history? The reference has no such chart, so none is planned | Confirm before F7 if you want one |
| QF-02 | Open question | Should the desktop layout be a genuine two-pane view (list plus detail) or just a wider mobile layout? | Decide before F4. A two-pane view adds roughly a phase of work |

## 10. What to do first

F0 and F1 depend on nothing and need no backend. Start F0 today, since the backend is already at P17 and will not block you. F2 needs D-F05 resolved, which is one check against the swag repository.

## Appendix A: Coding-agent brief template

```
You are implementing Phase <Fn> of the frontend described in docs/frontend-plan.md.

CONTEXT
- Read Sections 1 to 6 (product, decisions, stack, architecture, conventions, route map) and Section 8 Phase <Fn>.
- The backend plan (docs/backend-plan.md) is authoritative for all API contracts. Do not invent endpoints,
  field names, enum values or error codes. If a screen needs something the API lacks, stop and report it.
- Phases <list> are complete. Do not change shared primitives, tokens or the API client unless this phase says so.
- Stack: React 19, TypeScript strict, Vite, TanStack Router + Query, Tailwind v4, Radix/shadcn, Vaul, Motion.
- NO global state library. State ownership is Section 4.2 — follow that table exactly.
- Money is decimal.js-light and strings. Number(), parseFloat and toFixed on money are forbidden.
- Environment is WSL2: Linux filesystem, Node 22 via fnm, pnpm. Never add a Windows-side dependency.

OBJECTIVE
<copy the phase goal>

SCOPE
Implement only tasks <Fn-T01..Tnn>.

OUT OF SCOPE
Anything in later phases. Do not add a dependency that is not in Section 3 without justifying it in your report.

TECHNICAL REQUIREMENTS
Follow Section 5: generated API client only, query-key factory, Amount for all money, AppError handling,
URL-held view state, tokens for all styling, loading/empty/error states on every screen, and the
performance budget.

STEPS
1. Types and schemas (Zod + generated API types). 2. Pure logic with unit tests. 3. Components, mobile-first.
4. Route wiring and data fetching. 5. MSW handlers and component tests. 6. One Playwright flow.
7. Check both themes, 360px and 1280px, and keyboard navigation.

ACCEPTANCE CRITERIA
<copy from the phase>

DELIVERABLES (report back)
- Files created or changed
- Routes added and the API endpoints each consumes
- Output of pnpm lint, typecheck, test, test:e2e, build (including the bundle size table)
- Screenshots at 360px and 1280px, both themes
- Deviations from the plan and why
- Open questions and any technical debt introduced
```

## Appendix B: Design tokens

Starting values, derived from the reference screenshots. F1 implements these; adjust them there rather than in components.

```css
:root {
  /* Surfaces — dark is the default */
  --bg:            #000000;   /* page */
  --surface-1:     #121212;   /* card */
  --surface-2:     #1C1C1E;   /* raised: sheet, input */
  --surface-3:     #2C2C2E;   /* chip, segmented track */
  --border:        #2A2A2C;
  --border-strong: #3A3A3C;

  /* Text */
  --label:           #FFFFFF;
  --label-secondary: #AEAEB2;
  --label-tertiary:  #6E6E73;

  /* Accents */
  --accent:   #4480EE;  /* primary action, selection */
  --positive: #34C759;  /* income, gains */
  --negative: #FF453A;  /* expense, losses */
  --warning:  #FFD60A;
  --transfer: #5E8EF7;

  /* Radius — generous, as in the reference */
  --r-sm: 10px;  --r-md: 16px;  --r-lg: 22px;  --r-xl: 28px;  --r-full: 999px;

  /* Spacing, 4px base */
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 20px; --s-6: 24px; --s-8: 32px;

  /* Elevation — restrained; depth comes from surface steps, not shadow */
  --shadow-sheet: 0 -8px 32px rgb(0 0 0 / 0.45);
  --shadow-card:  0 1px 2px rgb(0 0 0 / 0.30);

  /* Motion */
  --spring-sheet: 380 stiffness / 32 damping;
  --spring-press: 500 stiffness / 30 damping;
  --dur-fast: 150ms;  --dur-base: 220ms;
  --dur-count: 700ms; --dur-draw: 900ms; --dur-bar: 500ms; --dur-sweep: 700ms; --bar-stagger: 40ms;

  /* Layout (addendum F11) */
  --page-max-wide: 1200px;  --page-max-form: 960px;  --gutter: 16px;

  /* Type */
  --font-sans: 'Inter var', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;  /* addendum 5, F23 */
  --text-xs: 12px; --text-sm: 14px; --text-base: 16px; --text-lg: 20px;
  --text-xl: 28px; --text-2xl: 34px;  /* balance headline */
}

[data-theme='light'] {
  --bg: #F2F2F7;  --surface-1: #FFFFFF;  --surface-2: #FFFFFF;  --surface-3: #E9E9EB;
  --border: #E5E5EA;  --border-strong: #D1D1D6;
  --label: #000000;  --label-secondary: #3C3C43;  --label-tertiary: #8E8E93;
}
```

**Rules.** Money uses `font-variant-numeric: tabular-nums` everywhere. Positive and negative values are distinguished by a sign and a label, not by colour alone. The tab bar and sheet headers use `backdrop-filter: blur(20px)` over a translucent `--surface-2`, with a solid fallback where the filter is unsupported.

## Appendix C: Screenshot traceability

| Screenshot | Frontend phase | Backend phase |
| --- | --- | --- |
| `login` | F2 | P2 |
| `home` | F9 | P8, P17 |
| `transaction_page`, `filter_history` | F5 | P8, P9 |
| `bank_list`, `bank_detail`, `bank_create`, `quick_edit_bank` | F4 | P7, P8 |
| `solid_edit_bank_card`, `gradation_edit_bank_card` | F4 | P7 |
| `bank_transfer` | F5, F7 | P9, P13 |
| `bank_history` | F4, F5 | P8 |
| `asset_page`, `portofolio` | F8, F9 | P10, P14, P15, P17 |
| `crypto_create` | F7 | P10, P11 |
| `us_stock_create`, `global_etf_create` | F7 | P10, P12 |
| `indo_stock_create`, `mutual_fund_create` | F7 | P10 |
| `expense_list`, `ncome_list`, `expense_income_category` | F6 | P6, P8 |
| `goal`, `add_goal` | F8 | P16 |
| `settings` | F3 | P3, P5 |
| `lock_n_hide` | F3 | P4 |
