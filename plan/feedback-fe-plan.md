# Frontend Feedback Plan (v2 polish): desktop layouts, B/W theme, wallet stack, investment wrappers

Nov 19, 2026 · Planning only. Companion to `plan/plan.md` (conventions: feature folders, `Amount` is the only money renderer, no global store, API contracts owned by the backend). Backend counterpart: `/home/jonathanr/code/hzzt/plan/feedback-be-plan.md` (authoritative for endpoints; names below are *expected* and must be reconciled with it).

## 0. Decisions (from user, resolved)

1. Percentage is at wrapper level: inline edit on the wrapper row (one wrapper at a time), not bulk and not per investment. Uses the BE single-wrapper update endpoint in `feedback-be-plan.md` (BE models wrapper as a text field on investments plus a per-category target table; align names with it when it lands).
2. No sub-categories for fixed assets, money owed, debts: the Assets page shows them by existing kind only (`kinds.ts`).
3. Wallet display config (hide logo/name/type) is synced per user via the backend. No localStorage fallback.
4. IDR and JPY: 0 decimals, no thousands separator problem to special-case beyond zero decimals; every other currency: max 2 decimals.
5. The post-share redirect lives in the investments share flow (concrete fix task in S1).
6. CI no longer runs Playwright e2e (removed from `.github/workflows/ci.yml` in S0). Unit, typecheck, lint, build and size stay in CI. Playwright specs are still written and run locally (`pnpm test:e2e`); wherever a phase acceptance says "e2e" or "Playwright", read it as "passes locally", and the S7 `test:e2e` gate is a local check, not CI.
7. Defaults for open questions (section 9): wrapper % inline per wrapper via `PATCH /spaces/{id}/investments/wrappers/{assetType}/{wrapperKey}`; wallet stack is layout-only; bottom sheets below 1024px, side drawers at 1024px+; crypto quantities exempt from the 2-decimal cap; strict B/W with green/red only for trends, PnL and expenses.
8. `VITE_API_URL=http://localhost:8080/api/v1/` is stored in the gitignored `.env` (documented in `.env.example`); the browser keeps calling `/api/v1` through the Vite proxy.

## Status

- [x] S0 Formatting + tokens
- [x] S1 Sharing redirect + shared-investment handling
- [x] S2 Desktop layout system (done: PageGrid/Panel/CardGrid, side drawer at 1024+, icon rail, max-w-xl removed, Home 12-col grid, card grids for Categories/Goals/Wallets. Deferred: settings sub-nav, two-column forms with live preview, auth split panel, `toHaveScreenshot` baselines (S7))
- [x] S3 History + filters desktop (inline FilterPanel at 1024+, writes URL directly; the xl third-column edit panel is satisfied by the side drawer from S2, no separate panel)
- [x] S4 Wallets stack + display config (display prefs use `PATCH /spaces/{id}/wallets/{id}/display-prefs` and `displayPrefs` on the wallet DTO per the BE plan, via `looseApi` until `sync:api` brings them into the schema; pie uses `baseBalance`/`pctOfTotal` when present, else same-currency wallets only)
- [x] S5 Investments wrappers (grouping is computed client-side from the flat list with Decimal, matching the BE rules, so it works before `GET .../investments/grouped` is consumed; targets via `GET/PATCH .../investments/wrappers` through `looseApi`, MSW-tested. Wrapper rename/delete menu is not built: the BE models the wrapper as a text field on investments with no wrapper CRUD endpoint; new wrappers are created from the Wrapper select on the create form. fakeApi now serves wrapper targets for local e2e)
- [x] S6 Assets page + bug test (composed from wallets, investments and manual assets: `GET /assets/summary` is not in the BE swagger yet, so `AssetBreakdownList` is fed by the existing hooks. The shared-in open test runs against MSW; re-run it against the real BE once its fix lands)
- [ ] S7 Polish

## 1. Current-state findings

| Area | Finding | Ref |
| --- | --- | --- |
| Desktop shell | Already exists: `AppShell` switches at 768px (`DESKTOP_QUERY`) to a fixed 240px sidebar + header + `main p-8`. Only the shell is desktop-aware. | `src/shared/ui/AppShell.tsx`, `src/shared/ui/layout.tsx` |
| Stretched mobile | Every screen wraps content in `mx-auto max-w-xl flex-col` (a 576px single column centred in a wide area). 17+ screens. Plan 1.3 explicitly deferred desktop layouts. | `HomeScreen.tsx:35`, `WalletsScreen.tsx:32`, `AssetsScreen.tsx:137`, `InvestmentsScreen.tsx:23`, `HistoryScreen`, `CategoriesScreen:66`, `GoalsScreen:62`, `SettingsScreen:12`, detail/form screens |
| Dashboard | Home is 5 stacked cards (Overview, NetWorth, Breakdown, Analytics, Calendar) + QuickActions. | `features/dashboard/HomeScreen.tsx`, `cards.tsx` |
| Filters | History filters live in a bottom `FilterSheet` (Vaul) on every viewport. | `features/transactions/FilterSheet.tsx`, `HistoryScreen.tsx` |
| Investments | Grouped by asset type only (`groupInvestments`). `InvestmentView.accountId` is an unused seam for BE P18. No per-group sums, no pie, no wrapper. | `features/investments/valuation.ts:50-70`, `types.ts:16`, `InvestmentsScreen.tsx:82-95` |
| Percentage per wrapper | No UI. Sharing screen edits per-participant share % only (sum must be 100.00). Different concept from "percentage per exchange/broker". | `SharingScreen.tsx:165` |
| Sharing redirect | Share flow: Detail `Link` (`InvestmentDetailScreen.tsx:200`) -> route `investments/$id/sharing.tsx` -> `SharingScreen`. `useSaveParticipants` (`hooks.ts:195-209`) PUTs participants then invalidates the whole `space.investments()` key; `SharingScreen.tsx:182-183` only toasts. A grep of `features/investments`, `routes`, `app` finds no `navigate`/`redirect` in the share path (only create `CreateInvestmentScreen:136` and delete `InvestmentDetailScreen:236`). So the observed redirect is indirect: S1 must reproduce it in Playwright and bisect. Suspects: broad invalidation remounting/re-seeding the screen, `meta: { silent: true }` mutation handling or a global handler in `shared/api/queryClient.ts`, and the `RequireFullTracking` wrapper. | `SharingScreen.tsx`, `routes/_authed/s/$spaceId/investments/` |
| Money format | Central `format()` exists but rounds to the currency's minor units (KWD would show 3 decimals) and `compact` uses 1 fraction digit. IDR/JPY already 0. Stray `.toFixed(2)` in Sharing; trade math uses `Decimal.toFixed()` (these are inputs, not display). `Amount` is the only renderer but price/quantity strings may be printed raw. | `shared/money/format.ts`, `shared/ui/Amount.tsx` |
| Expense colour | `Amount tone="auto"` gives green/red by sign. `TransactionRow` colours only the In/Out summary; expense rows are not consistently red. | `shared/ui/Amount.tsx`, `shared/ui/TransactionRow.tsx:104-109` |
| Theme | iOS-style dark default, light under `[data-theme='light']`; light bg `#f2f2f7`, grey surfaces, blue `--accent: #4480ee`, `--positive #34c759`, `--negative #ff453a`. Not strict B/W. | `src/styles/tokens.css` |
| Charts | Custom SVG (d3-scale/shape): `LineChart` strokes `stroke-accent` (single colour), `BarChart`, `DonutChart` (category-specific, count in centre). No glow. | `shared/charts/*` |
| Assets page | Shows section totals (Cash, Investments, Fixed, Owed, Debts) from `useNetWorthSummary`; lists items inside sections but no per-category/PnL breakdown for investments. Kinds in `features/assets/kinds.ts`. | `features/assets/AssetsScreen.tsx`, `kinds.ts` |
| Wallets | Flat `<ul>` of full-height `WalletCard`s with up/down reorder buttons. `WalletCard` always renders icon, name, type, balance. Card style via `cardStyle` DTO. | `features/wallets/WalletsScreen.tsx`, `shared/ui/WalletCard.tsx`, `shared/ui/cardStyle.ts` |
| Tests | Vitest + RTL + MSW per feature (`*.test.tsx`, `test/msw/api.ts`), Playwright e2e in `test/e2e/*.spec.ts` with `fakeApi.ts`, one chromium Desktop Chrome project, axe helper `test/axe.ts`. No visual-snapshot setup. | `playwright.config.ts`, `test/` |
| Motion | `motion` installed; `useSpring` presets in `shared/motion`. Reduced-motion handled by `MotionRoot`. | `shared/motion/*` |

## 2. Design tokens (strict B/W)

Edit `src/styles/tokens.css` only; components consume tokens (no hard-coded colours).

| Token | Dark | Light | Note |
| --- | --- | --- | --- |
| `--bg` | `#000` | `#fff` | Pure B/W |
| `--surface-1/2/3` | `#0a0a0a / #111 / #1a1a1a` | `#fafafa / #f4f4f4 / #ececec` | Neutral greys only (no tint) |
| `--border` / `--border-strong` | `#1f1f1f / #333` | `#e8e8e8 / #cfcfcf` | Hairlines |
| `--label` / secondary / tertiary | `#fff / #a3a3a3 / #737373` | `#000 / #525252 / #737373` | Check AA |
| `--accent` | `#fff` | `#000` | Primary buttons/active nav invert B/W. `--accent-label` is the opposite |
| `--up` (alias `--positive`) | `#22c55e` | `#15803d` | Only non-B/W colours in the app |
| `--down` (alias `--negative`) | `#ef4444` | `#b91c1c` | Used for expense amounts, losses |
| `--glow-up` / `--glow-down` | `0 0 6px color-mix(in srgb, var(--up) 55%, transparent)` (down likewise) | same at 35% | Applied via SVG `filter: drop-shadow(...)` on chart `path`; none on hover-less static bars |
| Radius | `--r-md 14, --r-lg 20` | | Keep; hairline borders + minimal shadow instead of heavy cards |
| Type | Inter var / system, tabular numerals for amounts | | |

Rules: chart line colour = `sign(last - first)` (up green, down red, flat `--label-secondary`); `Amount tone` gets `'expense'` (always red, includes income green only when `tone="auto"`); pie slices use a monochrome ramp (white-to-grey steps) plus a slice-index pattern/label so they stay B/W; only the active/selected slice may use up/down colour. Chart tokens: `--chart-1..8` greys. Use `prefers-reduced-motion` to disable glow pulse (glow is static anyway).

## 3. Desktop layout system (per page)

Breakpoints: `md` 768 (sidebar appears, exists), `lg` 1024 (2-col), `xl` 1280 (3-col). Container `max-w-[1400px]`, page grid `grid gap-6`. Shared primitives: `PageGrid` (12-col), `PageHeader` (title + actions + inline filters), `Panel` (Card variant), `Master/Detail` split. Sheets stay on mobile; on `lg` use a right-side `Drawer` (Radix Dialog) for create/edit forms (reuse `SheetShell` with a `side` mode). Shell: keep sidebar, add a collapsible rail (icons only, `xl:` expanded), space switcher + reveal toggle in the top bar, and the Add button stays in the sidebar.

| Page | Desktop proposal |
| --- | --- |
| Home | `lg`: 12-col grid. Row 1: Overview (4) + NetWorth line chart (8). Row 2: Breakdown donut (4) + Analytics (4) + Goals/QuickActions (4). Calendar full width row or right column on `xl`. Period picker in page header. |
| History | Two columns: left sticky filter panel (240px, inline replaces `FilterSheet`: period, wallet, category, type, search), right virtualised transaction list grouped by day. `xl`: third column transaction detail/edit panel (replaces `EditTransactionSheet` on desktop). Mobile keeps the sheet. |
| Wallets | Header (total + Add). Left (7/12): stacked-card deck (section 4). Right (5/12): pie of balance share per wallet + selected wallet quick info (recent transactions, Top up). `xl`: legend list under pie. |
| Wallet detail | Two columns: card + actions + display toggles (left), transaction list + mini chart (right). |
| Assets | Summary tiles row (Net worth, Cash, Investments, Fixed, Owed, Debts) then a 2-col grid of category panels (section 6). Net-worth line chart spans the top 8 cols. |
| Investments | Top: total value / cost / PnL tiles + overall pie (by investment). Below: 2-col grid, one `CategoryPanel` per asset type with nested wrapper sections; each wrapper has its pie on the right of the panel (section 5). Investment detail: left info + trades, right chart/valuation + sharing summary. |
| Categories | 2-col (income / expense) lists, with `BudgetProgress` in a card grid (`grid-cols-2 xl:3`). |
| Goals | Card grid `lg:2 xl:3`; goal detail 2-col. |
| Settings / Profile / Security / Currency / Space | Left settings nav (sub-sidebar of sections) + right content `max-w-2xl`; sections stay forms. |
| Forms (create investment, asset, goal, wallet edit) | Two-column form (fields left, live preview / card right, e.g. card editor preview). |
| Auth / invitation | Centred card, `max-w-md`, split background panel on `lg` (brand left). |

Remove all `max-w-xl` wrappers on list/dashboard pages; keep `max-w-2xl` for form/prose content only.

## 4. Wallet card stack (Motion)

- New `WalletStack` in `features/wallets/`: container with cards absolutely/`grid` overlapped by negative margin so only a ~56px top edge of each is visible (name, optional logo, balance on the edge); last card fully visible. Collapsed state is default.
- Expand: a "Expand / Collapse" button (also tapping a card edge) uses Motion `layout` + `AnimatePresence`/`animate` with the existing `useSpring('press'|...)` presets: cards spring from `y: index*56` to `y: index*(cardH+gap)`; selected card lifts. `prefers-reduced-motion` => instant. Keyboard: each edge is a `button` with `aria-expanded`; Enter on collapsed card focuses/expands then navigates on second action; reorder mode (existing up/down) forces expanded.
- Per-card display config (hide logo, name, type individually): extend `WalletCard` props `display?: {showLogo, showName, showType}` (default all true); toggles in `EditWalletScreen`/`CardEditorScreen` via `Switch`. Persist per user via the backend (synced across devices); the hook `useWalletDisplay(id)` reads from the wallet DTO and writes with an optimistic `PATCH` (rollback on error). No localStorage.
- Wallet pie: `PieChart` (new generic, section 7) fed by `wallets.items` balances in base currency with percent labels.

## 5. Investments: grouping, wrappers, pies, percentage editing

- Data: use the BE wrapper (exchange/broker/account) model. Expected endpoints (to confirm in BE plan): `GET /spaces/{id}/investment-wrappers` (list with `id,name,assetType?,percentage,value`), `POST/PATCH/DELETE /investment-wrappers/{id}`; investment DTO gains `wrapperId`; `GET /spaces/{id}/investments` summary gains `byCategory[{assetType,value,cost,pl,wrappers:[{id,name,value,pct}]}]`. FE falls back to computing sums client-side with `Decimal` if BE omits them. Do not invent fields: regenerate `schema.d.ts` via `pnpm sync:api`.
- `groupInvestments` becomes two-level: `assetType -> wrapper -> items` (replaces the `accountId` seam); extend `types.ts` (`InvestmentView.wrapperId`).
- UI: `CategoryPanel` header "Crypto $sum", nested rows "Binance $sum" / "Bybit $sum" (indented, collapsible), then investment rows; per-wrapper pie (investments within the wrapper by share) in the wrapper header (compact, 96px) on desktop, collapsible below on mobile. Page-level pie: share per investment (top N + "Other").
- Percentage per wrapper: inline edit on the wrapper row (`WrapperPercentInline`): tap the % to turn it into a 2-decimal input, Enter/blur saves one wrapper via the BE single-wrapper update endpoint, Esc cancels, optimistic update with rollback and error toast. Shows target % next to actual %; show the category's remaining/over-100 as a hint (soft, no bulk form). No per-investment percentage, no bulk sheet.
- Wrapper CRUD: create/rename/delete from the category panel menu; investment create/edit form gets a Wrapper select (`Select`) with "New wrapper" inline.
- Sharing: after saving `SharingScreen`, stay on the page (keep toast). Fix in S1: reproduce, find the cause per section 1, then narrow invalidation in `useSaveParticipants` to the single investment + participants keys and ensure the seeding `useEffect` (`SharingScreen.tsx:40`) does not reset rows on refetch.
- Shared-investment bug: `useInvestment(id)` for `ownership === 'SHARED_IN'` must hit the BE-fixed endpoint; on 404 `INVESTMENT_NOT_FOUND` show the existing `EmptyState` with "You no longer have access" rather than a crash/skeleton loop (`InvestmentDetailScreen.tsx:51`). Add MSW + e2e test after BE lands (S6).

## 6. Assets page

Per-section lists (grouped by category, with balance, no navigation needed to see them):
- Investments: category -> rows (name, balance/market value, PnL amount + %, tone up/down) from the investments list/summary.
- Cash: each wallet (grouped by type: bank, e-wallet, cash) with balance.
- Fixed assets, Money owed (receivables), Debts (liabilities): shown by existing kind only (no sub-categories), each a list of rows (name, balance) with the kind total. Reuse `KINDS` in `kinds.ts`.
- Expect `GET /spaces/{id}/net-worth/breakdown` (confirm with BE) else compose from `useWallets`, `useInvestments`, `useAssets`. Add `AssetBreakdownList` component; pies optional.

## 7. Shared components, formatting

New / changed components:
- `shared/charts/PieChart.tsx` (monochrome ramp, legend with `Amount` + percent, hover/focus highlight, accessible list); refactor `DonutChart` to wrap it or keep separate (categories).
- `LineChart`: auto up/down colour + glow (`filter: drop-shadow(var(--glow-*))`), expose `trend` prop; update `BarChart` accents.
- `Amount`: `tone="expense"` (red), amounts max 2 decimals, still the single renderer. Expense rows (`TransactionRow`, history list, detail, calendar, breakdown) pass `tone="expense"` for outflows; transfers stay neutral.
- `format()`: central change: `digits = ZERO_DECIMAL.has(code) ? 0 : Math.min(minorUnits(code), 2)` with `ZERO_DECIMAL = {IDR, JPY}`; `useGrouping` stays on (a thousands separator is fine, only decimals are removed); compact path capped at 2; `parseInput` uses the same digit rule; add `formatQty/formatPrice` helpers (max 2 decimals for money; quantities keep precision only on input fields, not display). Replace raw prints and `total.toFixed(2)`. Add an ESLint/biome-style grep test: no `toFixed(`/`Intl.NumberFormat` outside `shared/money`.
- Layout: `PageGrid`, `Panel`, `Drawer` side-mode, `FilterPanel` (inline desktop version of `FilterSheet` sharing the same `filters.ts` state), `SettingsNav`, `CategoryPanel`, `WrapperSection`, `WalletStack`, `WrapperPercentInline`, `AssetBreakdownList`.
- State: still server cache + URL; filters stay in URL search (existing `filters.ts`). New query keys in `shared/api/queryKeys.ts` for wrappers and breakdown; invalidate in `shared/api/invalidate.ts` on trade/wrapper changes. Wallet display config: BE field on wallet (expected `PATCH /wallets/{id}` with `display: {showLogo,showName,showType}`).

## 8. Phased tasks

| Phase | Tasks | Acceptance |
| --- | --- | --- |
| S0 Formatting + tokens (Ready now) | Central formatter (IDR/JPY 0 decimals, others max 2) + tests; `Amount` expense tone; B/W tokens dark/light; up/down aliases; chart line trend colour + glow; update `Gallery` | Unit tests on `format`: IDR and JPY show 0 decimals, USD/EUR 2, KWD capped at 2, compact, negative, large; no `toFixed`/`Intl` leak grep test; axe contrast AA in both themes; Gallery screenshots for both themes; expense amounts have red class in `TransactionRow` test |
| S1 Sharing redirect + shared-investment handling | Playwright repro of the post-share redirect in the investments share flow; fix per section 5; 404 handling in detail screen | e2e: open Investments -> investment -> Share -> save, URL stays `/investments/$id/sharing`, rows keep values, toast shown. MSW test for 404 state |
| S2 Desktop layout system | `PageGrid`/`Panel`/`Drawer`, shell rail, remove `max-w-xl`, rework Home, Categories, Goals, Settings, forms, auth | Playwright at 1440x900 and 1024x768 and 390x844: no horizontal scroll, content width > 900 at 1440, grid columns match section 3 (assert bounding boxes); screenshot snapshots (`toHaveScreenshot`, light+dark) for each page; mobile unchanged |
| S3 History + filters desktop | Inline `FilterPanel`, split view, desktop edit panel | e2e at 1440: filter without sheet, URL search updates; mobile still opens `FilterSheet` |
| S4 Wallets stack + display config | `WalletStack`, expand animation, pie, display toggles, `useWalletDisplay` | RTL: collapsed shows edges only, expand button toggles `aria-expanded`; e2e: expand animation completes, tapping card opens detail; reduced-motion test; toggles hide logo/name/type independently and persist; wallets pie sums to 100% |
| S5 Investments wrappers | Two-level grouping, category sums, wrapper pies, page pie, wrapper CRUD + percent editor, wrapper select on form | Unit: `groupInvestments` sums via Decimal; RTL: "Crypto $X / Binance $Y / Bybit $Z" structure and sums; percent editor validates sum; e2e on desktop shows pies per wrapper; blocked until BE endpoints exist |
| S6 Assets page + bug test | `AssetBreakdownList`, per-item PnL, categories for all kinds; shared-investment open test | RTL/e2e: every category, balance, PnL shown; test that a shared-in user opens an investment without "not found" (after BE fix) |
| S7 Polish | Visual regression baseline, performance budget check (`pnpm size`), Lighthouse | `pnpm lint typecheck test test:e2e size` green; bundle within budget; Playwright projects add `desktop` (1440) and `mobile` (Pixel 7) |

Playwright additions: add projects `desktop-1440`, `tablet-1024`, `mobile-390`; theme toggled through `data-theme`; extend `test/e2e/fakeApi.ts` for wrappers/breakdown/wallet display.

## 9. Open questions

1. Are wrappers one set across all asset types (Binance only under crypto) or per type? Follows the BE plan (text field per investment, targets per category); confirm the update endpoint shape when the BE plan is final.
2. Strict B/W: confirm green/red only for trends, PnL and expenses, white/black primary button, monochrome pie ramp.
3. Wallet stack: only layout on desktop or with a grid toggle? Reorder in stack mode (drag vs buttons)?
4. Bottom sheets vs side drawers between 768 and 1023px?
5. Crypto quantities/prices on the detail screen: exempt from the 2-decimal cap (display of non-money precision)?
