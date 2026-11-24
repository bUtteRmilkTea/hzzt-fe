# Frontend Plan Addendum 9: Layout and Chrome, Pies and Top Accounts, Investment Forms, Mutual Fund PnL, Crypto Refresh, Trade History (F40 to F44)

Nov 24, 2026 · @jo

This addendum extends `docs/frontend-plan.md` and follows `plan/feedback-fe-8-plan.md` (F33 to F39). It does not replace either. The backend plan is still authoritative for all API contracts. The backend counterpart is `../hzzt/plan/feedback-be-3-plan.md` (Phases L to Q).

| Field | Value |
| --- | --- |
| Document | Addendum 9 to the frontend plan: eleven feedback rows, R1 to R11 |
| Scope | Frontend, with backend dependencies marked per task. A task that needs a backend phase is blocked until it ships and uses the existing API until then where that is safe |
| Sources | One written list of eleven requests (no screenshots) |
| Status | Planning. Questions Q24, Q25, Q26 and Q28 are answered (section 5). F40 and F41 are Ready now. F42 is partly blocked (BE M, P, Q). F43 is partly blocked (BE L). F44 is blocked on BE N and O |

**Verification limits.** The feedback is text only, so every root cause below is **inferred** from reading the code. Layout, scroll and alignment tasks are checked in real Chromium (Playwright) at 1440 px and 390 px, and contrast with an automated axe run. Never tick them from unit tests alone (the same rule as addendum 8).

**Secrets.** No API key appears in the frontend. The only frontend variable is `VITE_API_URL`.

---

## 1. Feedback, mapped to causes

| # | Feedback | Page | Likely root cause (inferred) | Phase |
| --- | --- | --- | --- | --- |
| R1 | Categories page grid: more columns, no blank space ("3" was only an example, the column count follows the width) | Categories | `CategoriesScreen.tsx:175`: `grid-cols-1 gap-4 lg:grid-cols-2`, inside a `PageGrid` child that is only `lg:col-span-8` (the other 4 columns are `CategoryRail`). So there are at most 2 columns and a large part of the page is empty | F40 |
| R2 | No header in any page | All | `PageHeader` always renders an `<h1>` (`shared/ui/PageHeader.tsx:26`). Four tab screens render their own `<h1>`: Home (`HomeScreen.tsx:44`), Wallets (`WalletsScreen.tsx:170`), History (`HistoryScreen.tsx:111`), Assets (`AssetsScreen.tsx:266`) | F40 |
| R3 | Union the same crypto held on two exchanges into one slice; show all assets; make it scrollable | Investments | `topSlices` (`investments/valuation.ts:194`) makes one slice **per investment id**, keeps the top 6 and folds the rest into "Other". `PieChart` has no height limit on its legend, and `RAMP` has 8 colours that cycle | F41 |
| R4 | Too much blank space on the asset detail page | Asset and investment detail | `AssetDetailScreen.tsx:56`: a two column grid `[26rem | 1fr]` whose right column holds only the History list, or just "No changes yet." (a one line text), so on desktop most of the page is empty. `InvestmentDetailScreen.tsx:114` is one narrow column of stacked cards on `width="form"` (1120 px) with a few rows each | F40 |
| R5 | Total amount, percentage and "Set target" are not on one line, per section | Investments | `CategoryPanel.tsx`: the wrapper header is `items-start` with the toggle button (name and amount) in one flex child and `WrapperPercentInline` in another. That component is a **column** (`flex-col items-end`): the percent and the target chip on the first line, and "x% left in category" on a second line. So the amount, the percent and the chip sit at different heights, and the extra line changes the row height by section | F40 |
| R6 | Add PnL for mutual funds, since the value is updated each month | Investment detail | No history exists, only today's NAV and `unrealizedPl` (BE R6). The detail screen has Buy and Sell but no way to record a new NAV, and no per-month PnL | F42 (needs BE Q) |
| R7 | Exchange/broker is asked twice in Add investment | Add investment | `CreateInvestmentScreen.tsx:557` renders `WrapperField` ("Exchange / broker (optional)") **and** line 564 renders every `detailFields` entry, which for crypto, ID stock, US stock and ETF includes `exchangeOrWallet`, `broker` or `platform`. Both feed the same grouping (`wrapperOf`, `valuation.ts:82`) | F42 (BE M cleans the metadata) |
| R8 | On the Assets page show only the top 3 broker or exchange, with current PnL and percentage | Assets | `AssetsScreen.tsx:243` lists **all** wrapper groups (`accountGroups`), each capped to 5 rows (`capEach`), with the total and share but no PnL on the group header. PnL exists only per row | F41 (BE L-T5 for the percentage) |
| R9 | Auto refresh crypto price every 15 minutes | Investments, Assets, detail | `useInvestments` has `refetchOnWindowFocus` and the global 30 s `staleTime`, but no `refetchInterval`, so a screen left open never shows a new CMC price. The server job runs every `CMC_REFRESH_MINUTES` (10 today, 15 after BE L) | F43 (BE L) |
| R10 | Transaction history on the asset detail page, deletable, the asset goes back to how it was before | Investment and asset detail | No list of trades exists in the UI: `features/investments/trade.ts` only posts trades. The backend can reverse the **latest** trade only (BE R10). The manual asset detail has a value History but no revert | F44 (needs BE N and O) |
| R11 | Remove "Expected yearly change (optional)" and "Staked quantity (optional)" from assets | Add investment, manual assets | `CreateInvestmentScreen.tsx:549-555` (and `schema.ts:109,134-145,195`), `AssetForm.tsx:34,266-268`, `AssetDetailScreen.tsx:80`, `TradeSheet.tsx:40` (staked limit on sell), and the **dynamic** `detailFields` render for crypto (`stakedQuantity`) | F42 (BE P) |

---

## 2. Impact on the existing plan

| Item | Impact |
| --- | --- |
| F26 and F30 (pies) | `PieChart` gains an optional legend height and scroll (F41). Callers that pass nothing are unchanged |
| F31 and F39 (growth chart) | Unchanged. The mutual fund valuations are shown as their own list (F42), not in the growth chart |
| F35 (every wrapper group collapsible) | Unchanged. F41 caps the number of groups on the Assets page, not their toggle |
| F33-T04 (`LineChart` tooltip) | Reused for the mutual fund NAV line (F42-T05) |
| `categories.test.tsx`, `assets.layout.test.tsx`, `breakdown.test.tsx`, `investments.layout.test.tsx`, `investments.form.test.tsx`, `investments.test.tsx`, `router.test.tsx` | Assertions updated, not deleted. Tests that find a screen by `getByRole('heading', { name })` keep working because the heading stays in the DOM, visually hidden (D-F52) |
| `shared/api/schema.d.ts` | Re-synced from `../hzzt/docs/swagger.yaml` when each backend phase ships. Until then the removed fields are simply not sent |

### New decisions

| ID | Decision | Status | Recommended |
| --- | --- | --- | --- |
| D-F52 | No header on any page | **Decided** (Q24 answered: every page) | Remove the page header **row** and the visible title everywhere (no `PageHeader` bar, no hand written `<h1>`). Keep one visually hidden `<h1 className="sr-only">` per page so screen readers, the router tests and the document outline keep a page name. The controls that lived in the bar are **not** deleted, because they are how the user adds, shares or goes back: the back button and the page action (Add, Share, Edit, Add goal) move into the content as a small toolbar row that appears only when the page has one (a back button on the left, the action on the right), with no title text. A page with neither shows nothing above its content. Auth screens (`AuthCard`) are not app pages and keep their title |
| D-F53 | Categories grid | **Decided** (Q25 answered: columns follow the space available) | An auto-fill grid: `grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr))`, so a phone gets 1 column, a tablet 2, a laptop 3 and a wide desktop 4 or more, and the page has no blank area at the right. The number of rows is however many categories there are. The list takes the **full** page width (`lg:col-span-12`); `CategoryRail` moves under the grid (and beside it only on a screen wide enough to keep four cards). Same rule as the existing auto grid in `shared/ui` (`xl:grid-cols-3 2xl:grid-cols-4`), reused if it fits |
| D-F54 | Which holdings are unioned in the pie | **Decided** (Q26 answered: every holding) | Same asset type **and** same symbol (upper-cased), for every type that has a symbol (crypto, ID stock, US stock, ETF). A mutual fund has no symbol, so it is never unioned. The slice shows how many accounts it spans ("BTC, 2 accounts") and a second legend line with the share per account. It has no link, because the Investments page has no filter by symbol |
| D-F55 | Pie legend with many slices | Proposed | **All** slices are drawn (no "Other" fold) and the legend is a keyboard focusable scroll region with a maximum height. The pie itself stays fixed on the left (row layout) or on top (stack) while the legend scrolls. Slices under 1% are drawn at a minimum angle so they stay visible and tappable |
| D-F56 | Top accounts on the Assets page | Proposed | The three biggest named brokers or exchanges by value, each with the **group value, PnL amount, PnL percent and share of the portfolio**, then a link "N more accounts, Open investments". Holdings without a wrapper are counted in the "more" line, never shown as an account. The percent comes from the server (BE L-T5); until then only the PnL amount is shown |
| D-F57 | Crypto refresh interval | Proposed | `refetchInterval` of 15 minutes on the investments queries (list, one investment, grouped and net worth summary), paused while the tab is hidden, aligned to the server job (not faster, a faster poll only reads the same price). A "Priced 4 min ago" line from the valuation `asOf` shows the age. The manual **Refresh price** button stays |
| D-F58 | Where the trade history shows | Proposed | A "History" card on the investment detail page, right column on desktop (this also fills the blank space of R4), below the position card on a phone. Rows: date, Buy or Sell, quantity, price, wallet, realised PnL for a sell, and a delete action (menu), with a confirm that says what will happen. See D-B9 on the backend for older trades |
| D-F59 | Mutual fund value update | Proposed | An **Update value** button on a mutual fund detail (next to Buy and Sell). A sheet with: date (default today), then either "NAV per unit" or "Total value" (a toggle; with total value the NAV is computed on screen as `value / units`, shown as helper text and sent as `nav`). The list below shows each month with NAV, value, PnL since cost, and change since the previous update |

---

## 3. Phases

F40 and F41 are independent and Ready now. F42, F43 and F44 start with their frontend-only tasks and take the backend fields as they land.

## Progress

**F40** (layout and chrome; Ready now)
- [x] F40-T01 Remove the page header on every page, keep one `sr-only` heading and move back and action into a title-less toolbar (R2, D-F52)
- [x] F40-T02 Categories: auto-fill grid that uses the full width (R1, D-F53)
- [x] F40-T03 Investments: one line section header, total, percent and target (R5)
- [x] F40-T04 Detail pages: no blank space (R4)
- [x] F40-T05 Tests and Playwright

**F41** (pies and top accounts; Ready now, percent blocked on BE L-T5)
- [ ] F41-T01 Union holdings by symbol in the pie (R3, D-F54)
- [ ] F41-T02 Show every slice, scrollable legend (R3, D-F55)
- [ ] F41-T03 Assets: top 3 accounts with PnL and percent (R8, D-F56)
- [ ] F41-T04 Tests and Playwright

**F42** (investment forms, mutual fund PnL; BE Phases M, P, Q)
- [ ] F42-T01 One exchange or broker field (R7)
- [ ] F42-T02 Remove expected yearly change and staked quantity (R11, BE P)
- [ ] F42-T03 Mutual fund: Update value sheet (R6, D-F59, blocked on BE Q)
- [ ] F42-T04 Mutual fund: monthly PnL list and NAV age (R6, blocked on BE Q)
- [ ] F42-T05 Mutual fund: NAV line with tooltip (R6, optional)
- [ ] F42-T06 Tests and Playwright

**F43** (crypto refresh; BE Phase L for the 15 minute job)
- [ ] F43-T01 15 minute `refetchInterval`, paused when hidden (R9, D-F57)
- [ ] F43-T02 "Priced N min ago" line and stale hint (R9)
- [ ] F43-T03 Tests and Playwright

**F44** (trade history, revert; BE Phases N and O)
- [ ] F44-T01 Investment detail: trade History card (R10, D-F58, blocked on BE N)
- [ ] F44-T02 Delete a trade with a confirm that states the effect (R10, blocked on BE N)
- [ ] F44-T03 Manual asset detail: revert the newest value change (R10, blocked on BE O)
- [ ] F44-T04 Tests and Playwright

### F40: Layout and chrome

| ID | Task | Detail | Priority | Size |
| --- | --- | --- | --- | --- |
| F40-T01 | No header on any page (R2, D-F52) | In `PageHeader.tsx` stop rendering a visible title: the `<h1>` becomes `className="sr-only"`. Replace the header bar by a **toolbar** that renders only when there is a back link or an `action` (back on the left, action on the right, no title text, no bottom margin when absent). Do the same for the four hand written headings (Home `HomeScreen.tsx:44`, Wallets `WalletsScreen.tsx:170`, History `HistoryScreen.tsx:111`, Assets `AssetsScreen.tsx:266`): keep the element as `sr-only`, and where the row only held the title remove the row. Where a page has an action (Add on Categories and Investments, Share, Edit, Add goal) put it in the same toolbar so it stays reachable. Check each screen for spacing that assumed the title (`-mt-3` on the subtitle in `InvestmentDetailScreen.tsx:116`, `mb-4` on the bar) and for pages that become a toolbar of one small button. Add a one line comment in `PageHeader` pointing at D-F52 so nobody re-adds the visible title. Sheet and dialog titles (`Sheet`, `ConfirmDialog`) are not page titles and stay. The tab bar and the browser tab title are unchanged | Critical | S |
| F40-T02 | Categories grid (R1, D-F53) | `CategoriesScreen.tsx:175` becomes `grid gap-4 lg:gap-6` with `grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr))` (a utility or a small `AutoGrid` in `shared/ui`). The list child of `PageGrid` takes `lg:col-span-12` so it uses the whole width, and `CategoryRail` goes under the grid (beside it only when there is room for four cards). Check `CategoryRow` at 17 rem (name truncation, the budget bar, the reorder buttons, the 48 px targets). Check the Income tab and a space with 1, 2, 3, 9 and 20 categories at 390, 768, 1024, 1440 and 1920 px: no empty column at the right, the last row may be short. Reorder with the keyboard still works (the visual order is row by row, the DOM order is the same) | Critical | M |
| F40-T03 | Investments section line (R5) | Rebuild the wrapper header in `CategoryPanel.tsx` as **one** row with fixed columns: `[chevron + name (truncates)] [amount] [actual %] [Set target / Target n%]` on desktop and tablet, `items-center`, `tabular` numerals, same row height whatever the state (target set, not set, editing). The "x% left in category" hint **moves out of the row** into the `TargetBar` caption line under the row (or the chip's tooltip), so it never changes the row height. On a phone (390 px) use two lines on purpose: line 1 `[name] [amount]`, line 2 `[actual %] [target chip]`, both lines `items-center`. Apply the same one row rule to the category header (`h2` plus the total) so the asset type total is on the name's baseline. `WrapperPercentInline` keeps its behaviour (Enter or blur saves, Esc cancels, error text under the row with `role="alert"`) and only changes layout. The Unassigned group keeps its read only percent on the same line | Critical | M |
| F40-T04 | Detail pages (R4) | **Manual asset detail** (`AssetDetailScreen.tsx`): the grid is `[26rem \| 1fr]` and the right column is empty when there is no history. Use `Page width="form"`; with no history render the card and the actions as **one centred column** and show "No changes yet." inside the card, not as a lone line; with history keep two columns on `lg`. F44-T03 puts the revert action in the history. **Investment detail** (`InvestmentDetailScreen.tsx`): on `lg` use `grid-cols-[minmax(0,26rem)_minmax(0,1fr)]`: left Value, Position and the action buttons; right the new trade History (F44) and, for a mutual fund, the valuations (F42). Until F44 ships the right column shows the "Price and position" card (price source, current price, realised PnL) so the page is never half empty. On a phone it is one column in the order Value, Position, History, actions. Remove the standalone `Line` rows that are empty (`v.base ? ... : null` already) and pull the Share and Delete buttons into a "More" row under the actions so the first screen shows the value, the position and the history | High | M |
| F40-T05 | Tests and Playwright | Unit: `PageHeader` renders an sr-only heading, no visible title and no row without back or action; the toolbar keeps the Add button; `CategoryPanel` header row has no wrapped child at 1440 (by bounding boxes in Playwright, not by class names). Playwright at 1440 and 390: Home, Wallets, History, Assets, Investments, Categories, both detail pages. Check no visible title at the page top, the Categories grid fills the width at every size (the card count per row grows with the width and the right edge is within one gap of the page edge), the baseline of amount, percent and target chip within 2 px, and no empty area taller than 240 px on the two detail pages (a measured check on the main content box). axe clean | High | M |

### F41: Pies and top accounts

| ID | Task | Detail | Priority | Size |
| --- | --- | --- | --- | --- |
| F41-T01 | Union holdings (R3, D-F54) | New `unionSlices(items, label)` in `features/investments/valuation.ts` (or `pie.ts`), used by the "by investment" mode of `InvestmentsScreen.tsx:34` instead of `topSlices`. Key: `${assetType}:${symbol.toUpperCase()}` when a symbol exists, else the investment id. For each key sum `baseValueOf(i).value` with `Decimal` (the figures are the server's, converted by the server, so this is a sum of server numbers in one currency, display only). Name: the symbol (for crypto "BTC") with the first holding's name as a tie break; the slice carries `accounts: n` and the list of `{wrapper, amount}` for the legend line "Binance 60%, Hyperliquid 40%" (shares of the slice, `allocatePct`). A holding with no base value (no rate) is left out, as before. Sort by value, biggest first. Keep `topSlices` only if another caller needs it (**verify** with grep), otherwise delete it and its tests. `PieSlice` gets an optional `detail` string (a short second line in the legend); no other chart changes | Critical | M |
| F41-T02 | All slices, scrollable legend (R3, D-F55) | `PieChart.tsx`: add `legendMaxHeight?: number` (px, default none). When set, the `ul` gets `max-height`, `overflow-y: auto`, `overscroll-behavior: contain`, `tabIndex={0}`, `role="region"` and an accessible name ("Portfolio split legend, scrollable"), and a fade or border at the bottom edge when there is more to scroll. In `layout="row"` the `svg` stays put (`self-start`, `sticky top-0` inside the card) while the legend scrolls. Pass `legendMaxHeight` from the Investments pie (about 13 rows = 20 rem, so the pie and the legend are the same height). Remove the fold into "Other". Colours: `RAMP` has 8 tokens and cycles after 8 slices (`PieChart.tsx:34`), so with 9 or more slices two slices look alike. Extend the ramp to 12 `--chart-*` tokens in `tokens.css` for light and dark, checked with the `dataviz` skill validator for contrast and colour-blind distance, and keep the **index number** in the legend as the second cue (already there). Minimum slice angle in `donutGeometry` (about 1.5 degrees) so a 0.3% holding is still drawn and clickable; the legend still shows the true percent. The key of a slice is stable across refreshes so a price refresh (F43) does not replay the draw animation (`draw` only runs on first view) | Critical | M |
| F41-T03 | Top 3 accounts on Assets (R8, D-F56) | In `AssetsScreen.tsx` replace the investments `AssetBreakdownList` input with `topAccounts(items, label, spaceId, 3)` from `assets/breakdown.ts`, built on `accountGroups` (same sort: value, biggest first, ties by name, Unassigned excluded from the ranking). Each group header shows: name, value, **PnL amount with sign and tone** and **PnL percent**, and the share ("42.5% of portfolio") on a second line with the holdings count. The percent is read from the server group field (BE L-T5, `wrappers[].unrealizedPlPct`); until it ships hide the percent and show only the amount (rule from `plan.md` 5.2: no client computed percentages). Rows inside a group stay capped (`INLINE_INVESTMENTS`, 5) with "+n more". Under the groups a single link: "N more accounts, M holdings. Open investments" (to `/s/$spaceId/investments`). Holdings with no wrapper are only in the count. If there are 3 or fewer accounts there is no link. `AssetBreakdownList` gets a `GroupBlock` header slot for the PnL (extend `BreakdownGroup` with `pl?: { amount, pct }`, `Row` already renders the same shape) | High | M |
| F41-T04 | Tests and Playwright | Unit: two BTC holdings on two wrappers give one slice with the summed value and `accounts: 2`; same symbol, different asset type stays two slices; a mutual fund is never unioned; 25 holdings render 25 legend rows and no "Other"; `PieChart` with `legendMaxHeight` has the scroll region and the name; `topAccounts` returns 3 and the "more" line counts the rest; PnL tone and sign. Playwright at 1440 and 390: the legend scrolls with the mouse wheel, with touch and with the keyboard (Tab to focus, arrows), the page itself does not scroll while the pointer is over the legend, the pie does not move, axe clean, a 9 slice pie has 9 distinct colours (a pixel check on the legend dots) | High | M |

### F42: Investment forms and mutual fund PnL

| ID | Task | Detail | Priority | Size |
| --- | --- | --- | --- | --- |
| F42-T01 | One exchange or broker field (R7) | In `CreateInvestmentScreen.tsx:564` filter the `detailFields` render with a **hidden list**: `broker`, `exchangeOrWallet`, `platform` are never rendered (and not put in the default `details` at line 219, nor in the zod `detailShape` of `schema.ts:85`), because `WrapperField` already asks for it and the server maps the wrapper (BE M). This works **before** the backend change: the form simply stops sending those keys. US stock and ETF keep `exchange`, shown as **"Listing exchange"** (a different fact, required) with hint "For example NASDAQ or NYSE". When BE M lands the hidden list can be removed because the metadata no longer has them. Rename the `WrapperField` label to "Exchange, broker or platform (optional)" so one field covers all three words; for crypto the "New wrapper" placeholder is generic ("Name"). The summary rail (`SummaryRail`, line 116) keeps showing "In {wrapper}" | Critical | S |
| F42-T02 | Remove two fields (R11), from every asset | Delete the `Expected yearly change (optional)` field (`CreateInvestmentScreen.tsx:549-555`), `estimatedAnnualChangePct` from `defaultValues` (line 235), from `schema.ts` (lines 109, 195), and the `stakedQuantity` handling: `DETAIL_SCALE` entry and the cross field check (`schema.ts:26,134-145`), the staked limit in `TradeSheet.tsx:40-41` and `exceedsSellable` in `trade.ts` (selling is limited by the held quantity only). Hide `stakedQuantity` from the dynamic `detailFields` render (same hidden list as F42-T01) so the form is right **before** BE P. Manual assets: remove the field from `AssetForm.tsx` (34, 73-75, 110, 129, 149-150, 176, 266-268), the "Estimated change n% a year" line from `AssetDetailScreen.tsx:80` and the projection text in the form. `assets/hooks.ts:85` comment updated. Re-sync `shared/api/schema.d.ts` when BE P ships so the removed fields leave the types, and the compiler then finds any leftover use. Update every test and fake API fixture that sends or expects them (`investments.form.test.tsx`, `investments.test.tsx`, `assets.test.tsx`, the e2e fake). Do not add the old values to a "legacy" field. If an existing row has a value it is simply no longer shown | Critical | M |
| F42-T03 | Update value sheet (R6, D-F59, blocked on BE Q) | For `assetType === 'MUTUAL_FUND'` the detail screen shows **Update value** next to Buy and Sell. A `Sheet` (same component as `TradeSheet`) with a date (default today, max today, one entry per date, the server replaces a repeat), a toggle "NAV per unit / Total value", the amount field with the currency prefix (the shared money input), and an optional note. With "Total value" the sheet shows "NAV = value / units" as helper text computed with `Decimal` to the field scale, and sends the NAV. Validation on the client mirrors the server (non negative, at most 8 decimals), the server error codes show under the field. On success: toast, invalidate the investment, the list, the valuations and the net worth queries. Hidden for a shared-in (read only) investment. Until BE Q ships the button is not rendered (no fallback that edits `manualPrice`, so no second path) | High | M |
| F42-T04 | Monthly PnL list (R6, blocked on BE Q) | A "Value history" card (right column on desktop, F40-T04) from `GET .../valuations`: one row per update with month and year, NAV, value, **PnL since cost** (amount, percent, tone) and **change since the previous update** (amount, percent, tone, a dash for the first row). All figures are the server's. A footer line "NAV last updated N days ago" from `valuation.navAgeDays`, in the warning tone above 35 days. The newest row has a delete action with a confirm: "Delete this update? The price goes back to {previous NAV}" (BE Q-T4). An empty state: "Add your first value to see monthly PnL", with the Update value button. The same NAV age appears as a small chip on the investment row (`InvestmentRow.tsx`) and in the price source badge (`priceSource.tsx`) for a fund older than 35 days | High | M |
| F42-T05 | NAV line (R6, optional, last) | With 3 or more valuations show a small `LineChart` of value against cost over time, with the tooltip of F33-T04. Cut first if time is short | Low | S |
| F42-T06 | Tests and Playwright | Unit: the three wrapper detail fields are not rendered and not sent (create with a wrapper and no details keeps one group); `exchange` label; no field named expected change or staked anywhere (a test over the rendered form for each of the five types); selling the full quantity of a crypto is allowed; Update value computes NAV from a total; the list shows the server PnL, never a recomputed one; delete of the newest row reverts the price; read only for shared-in. Playwright: create a crypto, a US stock and a mutual fund through the form, assert one exchange field per form; the fake API gets the valuations endpoints with the BE contract. Axe clean on the sheet | High | M |

### F43: Crypto refresh

| ID | Task | Detail | Priority | Size |
| --- | --- | --- | --- | --- |
| F43-T01 | Interval (R9, D-F57) | Add `CRYPTO_REFRESH_MS = 15 * 60_000` next to `LIST_STALE_TIME` in `shared/api/queryClient.ts`. Set `refetchInterval: CRYPTO_REFRESH_MS` and `refetchIntervalInBackground: false` on `useInvestments`, the single investment query, the grouped query and the net worth summary used by Home and Assets (`features/investments/hooks.ts:35`, `features/assets/hooks.ts`, the dashboard hook). Only when the space has an AUTO holding (read it from the list, the summary query keeps polling only when `investments.items.some(priceMode === 'AUTO')`), so a cash only space never polls. `refetchOnWindowFocus` stays. A refetch must not reset scroll, open sections or an open edit field (use the existing `placeholderData: keepPreviousData` and never a Skeleton on a background refetch). Do not poll the growth history | High | S |
| F43-T02 | Age and stale hint (R9) | The price badge and the detail screen show "Priced N min ago" (from the valuation `asOf`, updated each minute by a light timer, not by a refetch). The stale warning (`PRICE_STALE`) already exists (F34-T01); text updated to "Last price N min ago, retrying". A tiny live region (`aria-live="polite"`) is **not** used for the refresh, a price changing every 15 minutes must not be read out. The Refresh price button keeps its cooldown | Medium | S |
| F43-T03 | Tests and Playwright | Unit with fake timers: the list refetches after 15 minutes and not before, not while hidden, not for a space without an AUTO holding, and the Amount animation does not replay on unchanged values. Playwright with the fake CMC and a fast clock (`page.clock`): the portfolio value changes after the fake price changes and the interval passes | Medium | S |

### F44: Trade history and revert

| ID | Task | Detail | Priority | Size |
| --- | --- | --- | --- | --- |
| F44-T01 | History card (R10, D-F58, blocked on BE N) | `useInvestmentTrades(spaceId, id)` (infinite query, cursor, 20 per page, "Load more") on `GET /investments/{id}/trades`. A "History" card on the investment detail (right column on desktop, F40-T04): a header with the count, then rows: date (`d MMM yyyy`, time in the tooltip), a Buy or Sell tag (icon and word, not only colour), quantity, unit price, fee, the wallet name and the amount, and for a sell the **realised PnL** with sign and tone. The first line of the list is the **opening position** from `openingPosition` ("Started with 0.5 BTC at 40,000", only when the investment was created with a position and no funding trade). Row actions in a kebab menu: Delete. Hidden for a shared-in viewer. Empty: "No trades yet. Use Buy or Sell". Loading shows 3 skeleton rows, an error shows Try again, and an `aria-label` on the list | Critical | M |
| F44-T02 | Delete a trade (R10, blocked on BE N) | A `ConfirmDialog` that says what happens, using the row and the position before and after from the API: "Delete this buy of 0.2 BTC? Your position goes from 1.2 to 1.0 BTC, average price from 41,200 to 40,000, and 8,240 is returned to Main wallet." The destructive button is "Delete trade". The wallet effect and the position effect come from the row, never recomputed on the client. Errors: 422 `TRADE_DELETE_BREAKS_LATER_SELL` shows "This buy pays for a later sale. Delete or edit that sale first" with a link that scrolls to the row named by the error; 403 `OWNER_ONLY`; 404 means it was already gone (toast, refetch). On success invalidate the investment, the list, the trades, the wallet and wallets list, the dashboard and the net worth queries, and show a toast "Trade deleted, position restored". The query keys come from one helper so no screen keeps stale numbers. The newest row is visually normal; if BE keeps option A (latest only, D-B9), the other rows show a disabled delete with the reason text `blockedReason` instead of hiding it | Critical | M |
| F44-T03 | Revert a manual asset value change (R10, blocked on BE O) | In the History list of `AssetDetailScreen.tsx` show **Revert** on the newest entry only (the API says `canRevert`). Settlements already have their delete path; the row text for a settlement offers "Delete settlement" which calls the existing endpoint. Confirm: "Set the value back to {previous value}?". On 409 `VALUE_CHANGED_SINCE` refetch and explain. A revert refreshes the net worth summary | Medium | S |
| F44-T04 | Tests and Playwright | Unit: list render, paging, opening position line, the confirm text uses the row's own numbers, each error code, the shared-in read only, query invalidation list. Playwright with the fake API: buy twice, delete the second (position and wallet restored), delete the first (replay result shown), try a delete that the fake refuses with the 422 code. A manual asset: update the value twice, revert the newest. axe clean on the dialog, keyboard only delete | High | M |

---

## 4. Risks

| ID | Type | Risk | Mitigation |
| --- | --- | --- | --- |
| RF-46 | Risk | Removing the visible title makes pages look unlabeled, and the active tab is the only cue | The bottom tab and the sidebar already show the active section. Sub pages keep their back button. The sr-only heading stays (D-F52). Q24 is answered: no title on any page |
| RF-47 | Risk | A three column Categories grid is cramped on a 1024 px laptop | Three columns start at `lg` only if each card is at least 18 rem wide (`minmax(18rem, 1fr)` auto-fit as a fallback), checked at 1024 and 1280 |
| RF-48 | Risk | Unioning by symbol hides that one slice is two holdings with different wrappers or currencies | The legend line lists the accounts and their share, and the values are the server's base currency figures (D-F54) |
| RF-49 | Risk | A scroll region inside a page traps keyboard or touch scrolling | `overscroll-behavior: contain` only on the legend, a visible focus ring, the region is tabbable, and F41-T04 checks touch and keyboard in a real browser |
| RF-50 | Risk | Twelve chart colours are hard to tell apart | The index number stays as the second cue, the palette is checked with the `dataviz` validator, and the legend row has the name, so colour is never the only cue |
| RF-51 | Risk | A 15 minute poll on every open tab adds load and flashes numbers | One `refetchInterval` (15 minutes, hidden tab paused), placeholder data during the refetch, and the `Amount` animation only when the value changes |
| RF-52 | Risk | Deleting a trade surprises the user by changing realised PnL and the wallet | The confirm text states the effects from the server row. Nothing is recomputed on the client |
| RF-53 | Risk | The frontend ships before the backend and calls endpoints that do not exist | Each blocked task is gated on the path being present in `shared/api/schema.d.ts` after the sync. Until then the old behaviour stays and no request is made (same rule as RF-38) |
| RF-54 | Risk | Removing the staked limit lets someone sell tokens that are staked elsewhere | The backend decides (BE P, Q22). The frontend simply no longer shows a limit that the server does not enforce |
| RF-55 | Risk | Removing form fields breaks an old test or fixture silently | The compiler (after the schema sync) and a rendered form test per asset type find leftovers, and the fake API rejects unknown keys like the real one |

---

## 5. Next steps

1. **Answer Q27** (below, the only open question). F40 and F41 can start now.
2. Start with F40 and F41 (Ready now, independent). F42-T01, F42-T02 and F43-T01 are frontend safe before the backend (the form stops sending the fields, the poll uses the existing endpoints).
3. Order the release with the backend: BE Phase P with F42-T02 together (both change request shapes), BE M with F42-T01, BE L with F43, BE Q with F42-T03 and T04, BE N and O with F44.
4. After F41 and F40, run the full Playwright suite in a real browser once and fix what it finds.
5. After F44, re-run `pnpm size` and Lighthouse (F10) and the axe run of F37.

**Decisions from the user (Nov 24, 2026)**

- Q24 (answered): no header on any page. The title is removed everywhere (D-F52). The back and action buttons stay, in a title-less toolbar.
- Q25 (answered): the Categories grid is not fixed at three. It uses as many columns as the width allows, and the number of rows follows the number of categories (D-F53).
- Q26 (answered): the pie union covers every holding with a symbol (D-F54).
- Q28 (answered): both detail pages are in scope (investment detail and manual asset detail).
- Expected yearly change is removed from **everything** (investments and manual assets) and staked quantity from crypto. Rows that had a staked amount become fully sellable (BE Q21, Q22 answered yes).

**Open questions**

- Q27: "Top 3 broker/exchange": ranked by **value** (the plan)? And should holdings with no exchange be an "Other" row or only counted in the "more" line? The plan counts them only in the "more" line.

---

## 6. Corrections from the dry run (Nov 24, 2026)

Dry run on `development` at `f9de6f9` (no unmerged branch matters). No Decision (D-F52 to D-F59) changes.

**Baseline on development.** `pnpm lint`: 1 info, 0 errors (a `findIndex` to `indexOf` hint in a test). `pnpm typecheck`: clean. `pnpm test`: 63 files, 777 passed, 1 skipped. `pnpm size`: budget OK. Chromium launches and `pnpm dev` starts (Playwright `webServer`); `VITE_API_URL=http://localhost:8080/api/v1/` is never reached by e2e, which uses `test/e2e/fakeApi.ts` (no backend needed). Full Playwright run (once): 217 passed, 72 failed, 1 skipped. The 72 failures **already exist before any change**: 46 are `visual.spec.ts` (the snapshot folder is untracked and out of date), and 26 are in `a11y-polish` (touch targets), `add-return`, `auth`, `full-flow`, `gallery` (3), `investment-wrappers`, `investments`, `no-page-titles` (12), `spaces-settings` (2), `wallet-stack` (2), `wallets` (2). Each phase is compared with this list, a phase must not add a failure.

**Cited code, re-verified.** All cited files and symbols exist. Lines moved slightly after the quantity-precision PRs: `CreateInvestmentScreen.tsx` `WrapperField` use is at 557 and the `detailFields` render at 564 (as cited), the expected change field at 549-555 and `defaultValues` at 235 (as cited). `topSlices` is `valuation.ts:194`, used by `InvestmentsScreen.tsx:36` and `wrappers.test.tsx` only. `CategoriesScreen.tsx:175`, `AssetDetailScreen.tsx:56`, `InvestmentDetailScreen.tsx:114-116`, `AssetsScreen.tsx:243` and `TradeSheet.tsx:40` still match. `exceedsSellable` is in `trade.ts:70`. `stakedQuantity` is `schema.ts:26,134-145`. `LIST_STALE_TIME` is in `shared/api/queryClient.ts:14`. `useNetWorthSummary` lives in `shared/api/networth.ts`, not in a dashboard hook.

**R2 is real on development.** The page `<h1>` is visible everywhere (`PageHeader.tsx:25` and five hand written ones: Home, Wallets, History, Assets, and `PlaceholderScreen.tsx:8`). `test/e2e/no-page-titles.spec.ts` (from an earlier addendum) already asserts the sr-only behaviour and fails today (12 tests). F40-T01 should turn it green. The Home heading also holds the `active-space` subtitle (space name and currency): the subtitle is kept as a small context line, only the visible "Home" is removed.

**Backend contract (`../hzzt` `development:docs/swagger.yaml`).** No `/trades`, no `/valuations`, no `value-changes`, no `navAgeDays`, no `openingPosition`. So F42-T03/T04/T05 and F44 stay blocked. **Correction to the plan:** `investments.WrapperGroupDTO.unrealizedPlPct` **does** exist (and `unrealizedPl`), and the front end schema already has it. But it is per asset type and per wrapper (`/investments/wrappers`), while F41-T03 ranks accounts **across** asset types. A cross type account percent would be a client computed percentage, which is not allowed. So in F41-T03 the PnL **amount** is shown (a sum of the server's per holding base figures, the same method `accountGroups` already uses for the group total) and the **percent stays hidden** (and unticked in the notes) until the backend sends an account level percent.

**F43 note.** `CMC_REFRESH_MINUTES` is a backend concern. The 15 minute poll uses the existing endpoints and is safe before BE L.
