# Frontend Plan Addendum 8: Data Correctness, Crypto Pricing, Assets Dropdowns, Goals on Home, UX Polish (F33 to F38)

Nov 23, 2026 · @jo

This addendum extends `docs/frontend-plan.md` and follows `plan/feedbacl-fe-7-plan.md` (F30 to F32). It does not replace either. The backend plan is still authoritative for all API contracts. The backend counterpart is `../hzzt/plan/feedback-be-2-plan.md` (Phases F to J).

| Field | Value |
| --- | --- |
| Document | Addendum 8 to the frontend plan: review rows T1 to T18 and four loose requests (L1 to L4) |
| Scope | Frontend, with backend dependencies marked per task. Tasks that need a backend phase are blocked until it ships and use the existing API until then where that is safe |
| Sources | A written UX review (T1 to T18, grouped P0, P1, P2) and four extra requests |
| Status | Planning. F36 and F37 are Ready now. F33, F34 and F38 are partly blocked on the backend. F35 is Ready now |

**Verification limits.** The feedback is text and screenshots only, so every root cause below is **inferred** from reading the code. Layout, motion, contrast and touch-target tasks are checked in real Chromium (Playwright) at 1440 px and 390 px, and contrast with an automated axe run plus a manual ratio check. Never tick them from unit tests alone. (Addendums 6 and 7 were shipped with the Playwright checks skipped. F33 to F38 do not repeat that, and section 5 asks for a full Playwright run for F24 to F32 too.)

**Secrets.** No API key appears in the frontend. The CoinMarketCap, Massive and FX keys stay on the backend (`.env`). The only frontend variable is `VITE_API_URL`.

---

## 1. Feedback, mapped to causes

| # | Feedback | Page | Likely root cause (inferred) | Phase |
| --- | --- | --- | --- | --- |
| T1 | Opening balance counted as income ("+100% vs previous period") | Home | Backend: a top up is stored as `INCOME` (backend plan, Phase F). The Home card only shows what the API sums. The UI also gives no way to say "this income is not income" | F33 (needs BE F) |
| T2 | Calendar cell shows 374 (income plus a $224.52 investment). History header shows `+$149.93` beside a transfer of `$224.52` | Calendar, History | The cell and the header add figures of different kinds on the client. The API returns `income` and `expense` separately and (after BE F) `net` | F33 |
| T3 | Net worth +20.7% with investments -32%. Y axis from -1k to 1.9k for a value under 1k, flat line. No touch tooltip | Assets, Investments | Percentage is value change including deposits (BE F adds `performancePct`). The chart axis is not fitted to the data range, and `LineChart` has no inspect interaction | F33 |
| T4 | Mixed currency fields. ID stock form shows USD/IDR fields and an average price with no prefix. US stock and ETF forms ask a manual "USD/IDR rate" in Rp | Create investment | Form shows the manual FX field unconditionally. The API already values with the stored rate when none is sent (BE Phase H) | F34 (needs BE H) |
| T5 | Home says "No category, add your first category" while 11 categories exist | Home | The empty state depends on the wrong list. It must depend on the transactions (or on the period total) | F33 |
| T6 | On the Categories sheets the space avatar overlaps the status bar clock | Sheets | Safe-area inset not applied on the Vaul sheet top (and the sheet header) | F37 |
| T7 | Wallet edit exists twice | Wallets | Two sheets: menu "Edit wallet" (name, balance, preview) and a second sheet (type, name, balance, Delete) | F35 |
| T8 | Quantity, current price and manual value all coexist. Default "Estimated annual change 5.5%" is unexplained | Create investment | No rule stated in the UI. Default comes from the backend column default (BE Phase H removes it) | F34 |
| T9 | Placeholders look like real values | Forms | Placeholder colour is too close to text, and the examples are real names | F37 |
| T10 | Disabled buttons look more active than enabled | Buttons | The disabled style keeps a bright fill (inferred: opacity only, no muted token) | F37 |
| T11 | Template wallet card text unreadable over the logo | Wallets | Text sits on the artwork with no scrim | F35 |
| T12 | Mixed languages, "Gaji" and "Salary" duplicates | App | System strings come from the server in English (BE adds `systemKey`). No localization of system rows | F38 (needs BE F) |
| T13 | Emoji render as odd glyphs. "Subscriptions" and "Snacks" share the sparkle | Categories, tabs | System UI uses emoji. Fallback icon is the sparkle. Seed icon is also the sparkle (BE F) | F38 |
| T14 | Filter sheet mixes expense and income in one list | History | One flat list, single select | F38 (needs BE I for the count and multi-select) |
| T15 | Settings is a 25 row flat list | Settings | No grouping or search | F38 |
| T16 | Home carousel hides Import, Insight, Goal, Consult | Home | A swipeable carousel with two dots | F36 |
| T17 | Low contrast secondary text, small tap targets | App | `label-secondary` token on near-black is under 4.5:1 (inferred), some controls under 48 px | F37 |
| T18 | Analytics chart has no tap to inspect | Analytics | Same missing interaction as T3 | F33 |
| L1 | Investments total must count crypto at the current CoinMarketCap price | Investments, Assets, Home | The backend already prices AUTO crypto from CMC, but the create form defaults to `MANUAL` (`CreateInvestmentScreen.tsx:204`) and nothing in the UI says which price is in the total (BE Phase G makes AUTO the default when the symbol resolves) | F34 (needs BE G) |
| L2 | The collapse dropdown per exchange or broker on the Assets page appears only for groups with 2 or more assets. Make it show for every group, even with 1 asset | Assets | `AssetBreakdownList.tsx:83`: `toggles = collapsible && g.title !== undefined && g.rows.length > 1` | F35 |
| L3 | Add a button to the Goals page from the Goals section on Home | Home | `GoalsCard` (`dashboard/cards.tsx:417`) only renders a "View more" button when there are more than 3 active goals. With 1 to 3 goals there is no link to the Goals page (and the empty state only offers "Add goal") | F36 |
| L4 | The graphic is too big and leaves blank space when there are 3 or more goals | Goals, Home | **Ambiguous in the feedback, so both places are covered.** On the Goals page each `GoalCard` has a 64 px `ProgressRing` plus a three line text block in a single column, so 3 or more cards make a tall, mostly empty page on desktop. On Home the card is a stack of bars with 3 rows at `gap-4`. See D-F44 for the proposed layout and Q10 | F36 |

---

## 2. Impact on the existing plan

| Item | Impact |
| --- | --- |
| F26 and F30 (pies) | Unchanged |
| F31 (Investments line) | The line gains the tooltip of F33-T03 and the contributions note |
| F28 (wallet reorder) and F32 (drag) | Unchanged. F35 touches the wallet edit sheet, not the card drag |
| `plan.md` 5.2 | Server figures only: the new `net`, `performancePct`, `fxRate` are displayed, never recomputed |
| `dashboard.test.tsx`, `assets.layout.test.tsx`, `goals.test.tsx`, `breakdown.test.tsx`, `investments.form.test.tsx` | Assertions updated, not deleted |

### New decisions

| ID | Decision | Status | Recommended |
| --- | --- | --- | --- |
| D-F44 | Which percentage the net worth card headlines | Proposed | The "return excluding deposits" (`performancePct`) as the large figure, labelled "Return, excl. deposits", and the plain value change as a smaller line "Change in value". Both come from the server. Until BE Phase F ships the card shows only the value change with the label "Change in value" (never "growth") |
| D-F45 | Calendar cell | Proposed | Show **net** (`net` from the API, income minus expense) with the sign and colour, and a dot for "has transactions". Tap opens a small panel with income and expense separately. Never add transfers, trades or adjustments. Until BE F ships, show `income - expense` using the two API fields (still no other types) |
| D-F46 | Goals layout | Proposed | Goals page: a responsive grid (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`), ring 48 px on a compact card, text on the right, so 3 cards fit in one row on desktop. Home: a compact list with a thin bar, **no ring**, max 3 rows, tighter spacing. See Q10 |
| D-F47 | Home goals button | Proposed | A header action on the card, always visible: "All goals" with a chevron (a `Link` to `/s/$spaceId/goals`). It appears in every state (0 goals keeps "Add goal" in the body). The bottom "View more" button is removed to avoid two buttons |
| D-F48 | Wrapper rows | Proposed | Every wrapper group on the Assets page is collapsible, including a group with one item, default open (as the Investments page already does in `CategoryPanel`). A group with a single item still shows its chevron and count |
| D-F49 | Price source in totals | Proposed | A small badge on each investment row and detail: "Live price" (CMC, with age), "Typed price", or "Manual value". A warning icon with text when stale or when a manual value overrides the market price. The portfolio card shows "Includes N holdings at typed prices" when any holding is not live |
| D-F50 | Home quick actions | Proposed | A fixed row of the 4 most used actions (Add transaction, Transfer, Add investment, Goals). Import, Insight and Consult move into a "More" sheet. No carousel, no dots |
| D-F51 | Language | Proposed | A language setting (English, Indonesian) in Settings, stored on the device, with the server's `systemKey` mapped to localized strings. No server-side translation (BE D-B3) |

---

## 3. Phases

F35, F36 and F37 are independent and Ready now. F33, F34 and F38 start with their frontend-only tasks and take the backend fields as they land.

## Progress

**F33** (data correctness; BE Phase F for T1, T3 return and calendar `net`)
- [ ] F33-T01 Empty state depends on transactions (T5)
- [ ] F33-T02 Calendar cell shows net, day panel shows income and expense apart (T2)
- [ ] F33-T03 History header never mixes kinds (T2)
- [ ] F33-T04 `LineChart`: fitted Y axis and touch tooltip (T3, T18)
- [ ] F33-T05 Net worth percentage per D-F44 (T3, blocked on BE F)
- [ ] F33-T06 "Not income" action on an uncategorised income (T1, blocked on BE F)
- [ ] F33-T07 Tests and Playwright

**F34** (investments; BE Phases G and H)
- [ ] F34-T01 Price source badge, stale and override notes (L1, D-F49)
- [ ] F34-T02 Portfolio card note for holdings not at live prices (L1)
- [ ] F34-T03 Crypto form: Auto is the default when the type supports it (L1)
- [ ] F34-T04 Currency fields per asset: prefix, no manual rate by default (T4)
- [ ] F34-T05 One value rule in the form, no silent 5.5% (T8)
- [ ] F34-T06 Tests and Playwright

**F35** (Assets and wallets; Ready now)
- [x] F35-T01 Every wrapper group is collapsible (L2, D-F48)
- [ ] F35-T02 One wallet edit component (T7) (Nov 23: BLOCKED, question for the user: there is one edit page (`EditWalletScreen`) and an options sheet that only links to it plus Delete. No duplicate edit form found, so there is nothing to merge. Which two screens did the review mean?)
- [x] F35-T03 Delete confirmation with the affected count (T7, uses BE Phase I when present) (Nov 23: counted from loaded rows, "at least" when paged; delete-impact endpoint absent from the API)
- [x] F35-T04 Template card scrim (T11) (Nov 23: no Jago template exists in this build, templates are CSS artwork; contrast checked on all 6 templates, unit and rendered pixels)
- [x] F35-T05 Tests and Playwright (Nov 23: T02 assertions N/A, see T02)

**F36** (Home; Ready now)
- [ ] F36-T01 "All goals" button on the Home Goals card (L3, D-F47)
- [ ] F36-T02 Compact Home goals and Goals page grid (L4, D-F46)
- [x] ~~F36-T03 Fixed quick action row (T16, D-F50)~~ DROPPED Nov 23 (Q13: no carousel in this build, see section 7)
- [x] F36-T04 Tests and Playwright (Nov 23: quick action assertions dropped with T03; Q10 both screens implemented)

**F37** (polish; Ready now)
- [ ] F37-T01 Safe-area insets on every sheet (T6)
- [ ] F37-T02 Placeholder style and generic placeholders (T9)
- [ ] F37-T03 Disabled button style and inline reason (T10)
- [ ] F37-T04 Contrast to AA and 48 px targets (T17)
- [ ] F37-T05 Tests, axe and Playwright

**F39** (growth chart; BE Phase K)
- [ ] F39-T01 Growth chart component with series switch and range picker
- [ ] F39-T02 Rising or falling summary from server fields
- [ ] F39-T03 Where it appears (Assets and Investments)
- [ ] F39-T04 Contributions note, coverage note, tests and Playwright

**F38** (localization, icons, filter, settings; BE Phase F for `systemKey`, Phase I for the filter)
- [ ] F38-T01 Language setting and `systemKey` strings (T12, D-F51)
- [ ] F38-T02 Vector icons for system UI and a default icon per category (T13)
- [ ] F38-T03 Filter sheet grouped by type, multi-select with a count badge (T14)
- [ ] F38-T04 Settings in sections with search (T15)
- [ ] F38-T05 Tests and Playwright

### F33: Numbers that can be trusted

| ID | Task | Detail | Priority | Size |
| --- | --- | --- | --- | --- |
| F33-T01 | Empty state | In `dashboard/cards.tsx` / `HomeScreen.tsx` find the card that renders "No category" and drive it from the period transactions (`count === 0`), not from categories. Copy: "No transactions yet", body "Add your first one to see where your money goes", button "Add transaction". A space with categories and no transactions shows this copy, never "add your first category". Categories empty keeps its own copy on the Categories screen only | Critical | S |
| F33-T02 | Calendar cell (D-F45) | In the calendar component show `net` (or `income - expense` from the two API fields until BE F ships), signed and coloured, with `tabular` numerals and the base currency. Remove any client sum of other kinds. Tap or Enter opens a small panel under the grid: Income, Expense, Net, Count. A day with only transfers shows no number, only the count dot. Values are formatted with the shared money formatter, no `+`/`-` hand building | Critical | M |
| F33-T03 | History header | The day header shows the day's income and expense as two separate figures (or the net, signed), never one sum with a transfer beside it. A transfer row shows its amount neutral (no `+`, no colour) with a transfer icon. Adjustments show as "Adjustment" with a sign from `direction` | Critical | S |
| F33-T04 | Chart axis and tooltip | In `shared/ui/LineChart` fit the Y domain to `min` and `max` of the points with 8% padding, never starting at 0 unless the data does, and never negative for non-negative data. Add tap and hover inspect: a vertical guide and a tooltip with the date and the value (money formatter), moving with the pointer or touch (touch drag on the chart does not scroll the page, use `touch-action: pan-y`). Keyboard: left and right arrows move the point when the chart is focused, with an `aria-live` readout. Reduced motion: no animated guide. The same tooltip is used by the analytics chart (T18, add the bucket label and a legend that toggles series) and the Investments line | Critical | M |
| F33-T05 | Percentage per D-F44 | `NetWorthCard` shows `performancePct` as the headline with the label "Return, excl. deposits" and `changePct` as "Change in value". If `performancePct` is null show only the change line. Both strings come from the server, `Number()` is for the sign and colour only. Add one line of help text on tap: "Deposits and withdrawals are not counted as return." **Blocked on BE Phase F** | High | S |
| F33-T06 | "Not income" action | On a transaction detail for an `INCOME` or `EXPENSE` with no category, show "This is not income" ("not an expense"). It calls `PATCH .../transactions/{id}` with `{ "type": "ADJUSTMENT" }` after a confirmation that says the balance does not change. After success the overview, calendar and history refetch. Hidden when a category is set. **Blocked on BE Phase F** (D-B2) | High | M |
| F33-T07 | Tests | Unit: empty-state rule (categories exist, no transactions); net value helper; axis fitting (all positive values, all equal values, one point, negative values). Component: calendar cell shows the net and never a sum of income and a transfer; the day panel lists income and expense separately; history header; tooltip appears on pointer move and on arrow keys. Playwright at 1440 px and 390 px: touch drag on a line chart shows a tooltip and does not scroll the page; the axis of a 874 value series is not -1k to 1.9k | Critical | M |

### F34: Investments priced by the market, honest forms

| ID | Task | Detail | Priority | Size |
| --- | --- | --- | --- | --- |
| F34-T01 | Price source (D-F49) | `PriceSourceBadge` for `priceSource` (`MARKET`, `MANUAL`, `MANUAL_VALUE`): "Live price · 2 min ago" (CoinMarketCap for crypto, "Market" for stocks), "Typed price", "Manual value". `stale` shows a warning icon and "Price is old". A `MANUAL_VALUE_OVERRIDES_MARKET` warning shows "Manual value is used instead of the live price" with a "Use live price" action that clears the manual value (PATCH `manualCurrentValue: null`). Use it in `InvestmentRow`, `InvestmentDetailScreen` and the Assets rows | Critical | M |
| F34-T02 | Portfolio note | Under the portfolio value (Investments hero, Assets investments row, Home): when any holding is not `MARKET` priced, a small neutral note "N of M holdings use a typed price" with a link to the list filtered to them. Not shown when all are live. No client sums: the count comes from the item list | High | S |
| F34-T03 | Auto default | In `CreateInvestmentScreen.tsx:204` the default `priceMode` becomes `AUTO` when `meta.supportsAutoPrice` (crypto, US stock, global ETF) and falls back to `MANUAL` otherwise. Picking an instrument from search links it. If the user clears the instrument, the form switches back to `MANUAL` and says why. Editing an existing investment keeps its saved mode. **Pairs with BE Phase G** (which also defaults on the server) | Critical | S |
| F34-T04 | Currency per asset (T4) | Use `quoteCurrency` from the type meta: price, average price and current value inputs show that currency prefix (`Rp` or `$`), never the space currency by mistake. Remove the USD/IDR fields from the Indonesian stock form (it is IDR only). The "USD/IDR rate" field is hidden by default and appears behind "Use my own exchange rate", with the provider rate shown as help text ("Today's rate: 16,200 · FX service"). When the asset currency equals the space currency no FX text is shown. **Blocked on BE Phase H for the rate text; the hiding of the manual field can ship now** | Critical | M |
| F34-T05 | Value rule and defaults (T8) | One helper line under the three fields: "Manual value overrides price × quantity." Once "Manual current value" has a value, the price field is disabled with the text "Not used while a manual value is set". Once the price is typed, the manual value shows its hint instead of disabling (the user may still choose to override). Estimated annual change: empty by default, label "Expected yearly change (optional)", help "Only used for projections. Leave empty for none." Never send 5.5. **Blocked on BE Phase H for the stored default; the form side ships now** | High | M |
| F34-T06 | Tests | Unit: default mode per type, badge text per source and staleness. Component: crypto form starts as Auto and a picked instrument is sent; switching off the instrument switches to Manual; the ID stock form has no USD field and `Rp` prefixes; manual value disables price; estimated change sent as absent when empty. Playwright: create a crypto holding against the fake CMC server and see the total change when the fake price changes; at 390 px no overflow | Critical | M |

### F35: Assets dropdowns, one wallet editor, readable cards

| ID | Task | Detail | Priority | Size |
| --- | --- | --- | --- | --- |
| F35-T01 | Every group collapses (L2) | In `assets/AssetBreakdownList.tsx:83` change the rule to `toggles = collapsible && g.title !== undefined` (drop the `rows.length > 1` condition). A one-row group shows its chevron, its title, its count ("1 asset") and its sum, default open, `aria-expanded` and the same `Collapsible` as other groups. Keep the rule that an untitled group never toggles. Check the persisted open state (if any) is keyed per group so one-row groups remember theirs | Critical | S |
| F35-T02 | One wallet editor (T7) | Merge the menu "Edit wallet" sheet (name, balance with the "new balance" preview) and the second sheet (type, name, balance, Delete) into one `WalletEditSheet` used by both entry points. Fields: type, name, balance with the preview (kept, the review likes it), card style as today, Delete at the bottom. Delete the unused component and its route or trigger. The balance copy keeps "recorded as an adjustment" (now literally true for top ups too) | Critical | M |
| F35-T03 | Delete confirmation | Delete opens a confirm dialog that states the impact from `GET .../wallets/{id}/delete-impact` ("This also removes 12 transactions and 3 transfers"). Without BE Phase I it counts from the loaded wallet transactions and says "at least". The confirm button is destructive, named "Delete wallet", and not focused by default. After success: toast, redirect to Wallets, refetch assets | High | M |
| F35-T04 | Template card scrim (T11) | In the wallet card component with `mode: TEMPLATE`, put a gradient scrim under the text (`linear-gradient(to top, rgb(0 0 0 / 0.55), transparent 60%)`) and keep the logo as the background. Also pick the text colour from the template's average luminance if the template meta has one, else white with the scrim. Contrast of name and balance against the worst case of the artwork must be at least 4.5:1 (checked in the test with a sample of the Jago template) | High | S |
| F35-T05 | Tests | Unit: `toggles` rule for 0, 1, 2 rows, untitled. Component: a group with one asset has a working toggle; one edit sheet opens from both entry points; delete shows the count and needs the confirm. Playwright at 1440 px and 390 px: collapse and expand a one-row group, wallet card text contrast on the Jago template | Critical | M |

### F36: Goals on Home, a compact goals layout, quick actions

| ID | Task | Detail | Priority | Size |
| --- | --- | --- | --- | --- |
| F36-T01 | All goals button (L3, D-F47) | In `GoalsCard` (`dashboard/cards.tsx:417`) add a header action "All goals" (`Link` to `/s/$spaceId/goals`, chevron, `size="sm"`, `variant="ghost"`) next to the title, visible whenever the goals query succeeded, with 0, 1, 2, 3 or more goals. Remove the bottom "View more" button (the header action replaces it). The empty state keeps "Add goal". Each goal row stays a link to its detail | Critical | S |
| F36-T02 | Compact goals (L4, D-F46) | Home: rows of icon and name, percentage, a 6 px bar and one amount line, `gap-3`, no ring, so 3 goals take about 3 x 56 px. Goals page: `GoalCard` becomes a compact card (ring 48 px with the percentage inside, name, one line "A of B", target date or monthly need on one line) in `grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3`, `items-start` so a short card does not stretch to a tall neighbour. Achieved goals go in a collapsed "Achieved" section below. A single goal does not stretch across the full width (max width on the grid item). Skeletons use the same grid and heights so nothing jumps. **Open: Q10** if the "graphic" meant something else | High | M |
| F36-T03 | Quick actions (T16, D-F50) | Replace the swipeable carousel with a fixed row (a 4 column grid of icon buttons, 48 px minimum, labels under) for Add transaction, Transfer, Add investment, Goals. Import, Insight and Consult move to a "More" button that opens a sheet. No dots, no horizontal scroll. Check the existing carousel tests and update them | High | M |
| F36-T04 | Tests | Component: the "All goals" link exists with 0, 1, 3 and 5 goals and points to the Goals page; the old "View more" is gone; compact rows render 3 goals; Goals page grid classes; quick action row has 4 buttons and a More sheet with 3 entries. Playwright at 1440 px and 390 px: 3 and 5 goals show no large blank area (the grid has no row taller than 1.5 x the median card height, measured), no overflow, quick action targets at least 48 px | Critical | M |

### F37: Polish and accessibility

| ID | Task | Detail | Priority | Size |
| --- | --- | --- | --- | --- |
| F37-T01 | Sheet insets (T6) | In the shared `Sheet` (Vaul) wrapper apply `padding-top: max(env(safe-area-inset-top), 0.75rem)` for full-height sheets and keep the sheet below the status bar (`max-height: calc(100dvh - env(safe-area-inset-top))`). Check every sheet: Categories, Filter, Wallet edit, Transfer, Add investment. The space avatar and clock must not overlap | High | S |
| F37-T02 | Placeholders (T9) | One token `--placeholder` at about 4.5:1 below the text colour but clearly lighter than a value (inputs, selects, textareas), italic off. Replace example values with generic ones: "e.g. Coin", "e.g. Broker", "e.g. Savings" and similar short text, no brand or real fund names. Search the forms for the four examples named in the review | Medium | S |
| F37-T03 | Disabled buttons (T10) | Disabled style: muted fill (`bg-surface-muted`), `text-label-tertiary`, no shadow, `cursor-not-allowed`, still 3:1 against the background so it stays visible but clearly inactive. Use `aria-disabled` plus `disabled`. Where the reason is known (Transfer: needs two wallets; Add investment: required field empty), show one line of help under the button ("Add a second wallet to transfer") linked with `aria-describedby` | High | M |
| F37-T04 | Contrast and targets (T17) | Measure `label-secondary` and `label-tertiary` on every surface in light and dark. Raise any token under 4.5:1 for body text (3:1 for large text and icons). Tap targets: at least 48 px (padding, not size, so layout does not shift) for buttons, icon buttons, list rows, tabs. Add an axe run to the Playwright suite for Home, Assets, Wallets, Goals, History, Settings in both themes, with zero serious or critical violations. Do not change the strict B/W direction (`plan/feedback-fe-plan.md` section 2); move values only | High | M |
| F37-T05 | Tests | Unit: token contrast helper test (4.5:1) for the final values. Component: disabled button has `aria-disabled` and the reason text. Playwright: axe on the six screens in both themes, target size check, sheet top inset with an emulated 44 px safe area | Critical | M |

### F38: Language, icons, filter, settings

| ID | Task | Detail | Priority | Size |
| --- | --- | --- | --- | --- |
| F38-T01 | Language (T12, D-F51) | A small `i18n` module (a typed dictionary, English and Indonesian, no library unless one is already in `package.json`), a Language row in Settings (device storage), and a `systemText(tx)` helper: if `tx.systemKey` is set use the dictionary, else show `tx.title`. Category and system labels use `system_key` when present. "Gaji" and "Salary" duplicates: the create category sheet shows the `409 CATEGORY_EXISTS_SIMILAR` message with "Use existing" and "Create anyway" (`force=true`). **Blocked on BE Phase F for the keys; the dictionary and Settings row can ship first** | Medium | M |
| F38-T02 | Icons (T13) | Replace emoji in the Expense and Income tabs and other system UI with `lucide-react` icons (already in the bundle). Categories keep the user's chosen emoji, but the picker gets a smart default from the name: a small static map (food, coffee, transport, subscriptions, snacks, health, gifts, salary, ...) with the sparkle never used as a fallback (use a neutral tag icon). `Subscriptions` and `Snacks` get different defaults. Keep the Noto Color Emoji font fallback for emoji that must stay | Medium | M |
| F38-T03 | Filter (T14) | The filter sheet groups categories under "Expense" and "Income" headings, multi-select with checkboxes and a count badge on the filter button ("Filters 3"). A group header has "Select all". Sends `categoryIds` (BE Phase I). Before Phase I the sheet sends the first selected id and shows a note that only one is applied, so nothing silently ignores a selection. Active filters show as removable chips | Medium | M |
| F38-T04 | Settings (T15) | Group the rows into sections: Account, Money setup, Automation, Data, Support (the row to section map is listed in the PR and checked against the 25 existing rows so none is lost). A search field at the top filters rows by label (case-insensitive, keyboard friendly, empty result text). Sections are headings, not collapsibles, so everything is still on one scroll. Settings stays in the wide tier (D-F24) | Medium | M |
| F38-T05 | Tests | Unit: `systemText` for each key and the fallback; icon default map (no two seeds equal, no sparkle fallback). Component: filter groups, count badge, chips; settings search keeps section headings only for non-empty sections; the 25 rows are all reachable. Playwright at 1440 px and 390 px: Language switch changes a system row and survives a reload; Settings search; filter with 3 categories | Critical | M |

---

## 4. Risks

| ID | Type | Risk | Mitigation |
| --- | --- | --- | --- |
| RF-38 | Risk | The frontend ships the "not income" action or `net` before the backend, and calls an endpoint that does not exist | Each such task is marked blocked and gated on the API field being present in `api/openapi.yaml`; until then the old behaviour stays and no new request is made |
| RF-39 | Risk | The crypto total changes when more holdings are priced live, and looks like a bug | The price badge and the "N of M holdings use a typed price" note explain the number (D-F49) |
| RF-40 | Risk | A tooltip on a chart steals touch scrolling | `touch-action: pan-y`, tooltip only on horizontal drag, tested on touch in F33-T07 |
| RF-41 | Risk | Raising contrast tokens changes the strict B/W look | Move values within the same hue family only, review screenshots in both themes, axe in CI |
| RF-42 | Risk | Merging the two wallet editors loses a field | A field checklist (both sheets) is copied into the PR and checked in the component test |
| RF-43 | Risk | "Graphic too big" (L4) is interpreted wrongly | The change is limited and reversible (ring size, grid, spacing). Q10 asks which screen was meant |
| RF-44 | Risk | Language support grows beyond a small dictionary | Scope is system strings only (the keys the server sends and the navigation). User data is never translated |
| RF-45 | Risk | A one-row group toggle is noise | Default open, so nothing is hidden by default, and D-F48 is what was asked |

---

## 5. Next steps

1. **Answer Q10** (below). Everything else can start.
2. Start with F35, F36 and F37 (Ready now, independent). Then F33 and F34 as the backend phases F, G and H land (a frontend branch can start on the frontend-only tasks first).
3. Order the release with the backend: BE Phase F and F33 together, BE G and F34 together, because the top up type and the total change what the user sees.
4. Playwright was skipped for F24 to F32. After F35, run the full Playwright suite in a real browser once, fix what it finds, then merge the open PRs.
5. After F38, re-run `pnpm size` and Lighthouse (F10), and the axe run of F37.

**Open questions**

- Q10: For "the graphic is too big and has too much blank space with 3 or more goals", which screen: the Goals page (ring cards), the Home Goals card, or both? The plan changes both with a compact layout (F36-T02).
- Q11: Is the Indonesian language scope in F38-T01 wanted now, or only the keys and Settings row for later?
- Q12: Should the "All goals" button also appear in the Home Goals card when there are 0 goals (next to "Add goal")? The plan assumes yes.

## 6. Corrections from the dry run (Nov 23, 2026)

A read-only dry run of `plan/prompt.md` against the repo found the facts below. They override the text above where they differ. The sections above are left as written on purpose.

| # | Correction | Effect |
| --- | --- | --- |
| C1 | **Wallet edit (F35-T02).** There is no `WalletEditSheet` and not two sheets. `EditWalletScreen.tsx` is a full page (route `wallets/$id/edit`) and `WalletDetailScreen.tsx` has a "Wallet options" sheet (`SheetShell`, Edit link and a Delete confirm), plus `TopUpSheet.tsx` | Reframe: merge the edit page and the options sheet's edit and delete into one editor, **after** reproducing the "two screens" the review describes in the browser. If it is not reproducible, stop and ask |
| C2 | **Quick actions (F36-T03).** No carousel, "Consult" or swipeable quick-action component exists in `src/features/dashboard` ("Consult" is only in `dashboard.test.tsx`). **The review may describe a different build** | Do not invent a component. First find out what the Home action area is, show it to the user, and ask. F36-T03 is blocked on that answer |
| C3 | **Empty state (F33-T01).** The string "No category / add your first category" does not exist in `src`. `HistoryScreen.tsx:181` has "Add your first expense or income" and `dashboard/cards.tsx:208` handles "Uncategorised" | Reproduce the screen from the review first (it may be the category breakdown card with only uncategorised rows). If the source cannot be found, stop and ask. The rule stays: driven by transactions, not categories |
| C4 | `net` is **already** in `api/openapi.yaml` (overview, calendar day and totals DTOs) and `CalendarCard` already uses `d.net` (`cards.tsx:341`) | F33-T02 is not blocked on the backend. Check why the review's cell still showed 374 (inferred: the cell or a tooltip adds fields), fix that |
| C5 | `categoryIds` is **already** supported by the transactions list | F38-T03 sends it now. Drop the "only the first id is applied" fallback and the BE Phase I dependency |
| C6 | `fxRate`, `priceSource`, `quoteCurrency`, `supportsAutoPrice`, `estimatedAnnualChangePct` are already in the OpenAPI. **Not** there: `performancePct`, `systemKey`, `delete-impact`, the `stale` flag, the `MANUAL_VALUE_OVERRIDES_MARKET` warning, `ADJUSTMENT` as a PATCH type | Blocked as marked: F33-T05, F33-T06, F38-T01 (keys), F35-T03 (count from loaded rows meanwhile), the stale and override parts of F34-T01 |
| C7 | The 5.5 is also a **client** fallback: `CreateInvestmentScreen.tsx:211` uses `meta.defaults?.estimatedAnnualChangePct ?? '5.5'` | F34-T05 removes that fallback too |
| C8 | Paths: the chart is `src/shared/charts/LineChart.tsx` (not `shared/ui`); the shared sheet is `src/shared/ui/SheetShell.tsx` (Vaul `Drawer`, not `Sheet`); `WalletCard.tsx` has no `TEMPLATE` mode, template styles live in `cardStyleSchema.ts` and `CardEditorScreen.tsx` | Use the real paths. For F35-T04 locate where a template card is drawn before adding the scrim |
| C9 | The Progress list order (F33...F38) differs from the prompt order (F35, F36, F37, F33, F34, F38) | Intentional (Ready-now phases first). Tick by phase name, not position |
| C10 | F37-T03 needs the Transfer and Add investment screens, and F37 touches `SheetShell` that F35 and F36 use | Branch each phase from `development`, resolve conflicts at merge, note it in the PR |
| C11 | Test fake: `test/fakeApi.ts` should be checked for a CMC price fake before F34's Playwright check. The real CMC and its key are never used from the frontend | Create the fake in the test setup if missing |

New open question: **Q13** Is the review written against this codebase? C2 and C3 (no carousel, no "No category" text) suggest some screenshots came from another build or a mock. Confirm which Home screen was reviewed.


## 7. Resolutions and additions (Nov 23, 2026, second pass)

**Q13 resolved: the review does not match this build for Home.** Import, Insight and Consult were removed on purpose (commit `8b0dda0`: "absent, not shown disabled"), so there is no carousel to fix. The screenshots most likely come from another build. Decisions:
- **F36-T03 (quick action row, T16, D-F50) is dropped.** Do not build it. If you still want a quick action row on Home, it is a new feature to plan separately.
- **F33-T01 (T5 empty state):** reproduce in the browser first. If the "No category" text cannot be shown in this build, mark the task "not reproducible" in the plan and move on.
- **T16 and D-F50** are void. F36 keeps T01 (All goals button), T02 (compact goals) and T04 (tests, without the quick action assertions).

**Phase order now:** F35, F36, F37, F33, F34, F38, F39.

### F39: Growth chart, are investments and assets rising or falling (needs BE Phase K)

**What the user wants.** To see the **net worth of the investments and of the assets** over a chosen timeframe and tell at a glance whether they are rising or falling. A rise caused by buying more is not growth, so the chart also says how much was money put in.

**Data the frontend needs from the backend (BE plan section 11, Phase K).** `GET /spaces/{spaceId}/net-worth/history?range=1W|1M|3M|6M|YTD|1Y|ALL` returning, in the base currency:
- `points[]`: `date`, `netWorth`, `investments`, `fixedAssets`, `assets`, plus `cash`, `receivables`, `liabilities`, and `live` on today's point. Up to about 120 points.
- `series.{netWorth,investments,fixedAssets,assets}`: `first`, `last`, `change` (money), `changePct`, `performancePct` (return excluding money put in), `netContributions`, `direction` (`RISING`, `FALLING`, `FLAT`).
- `coverage`: `firstPointDate`, `requestedFrom`, `short`.
Until Phase K ships the frontend can already draw `netWorth` and `investments` (they exist today) with the sign taken from the existing `changePct` fields. The other series and `direction` wait for the backend. The client computes nothing: no sums, no FX, no direction.

| ID | Task | Detail | Priority | Size |
| --- | --- | --- | --- | --- |
| F39-T01 | Chart | A `GrowthChart` built on `shared/charts/LineChart` (with the tooltip from F33-T04). A `SegmentedControl` to pick the series: Net worth, Investments, Assets (fixed assets), All assets, and a range picker 1W, 1M, 3M, 6M, YTD, 1Y, All (default 1M). The line colour follows `series[x].direction` (positive, negative, neutral), not the client sign. The Y axis is fitted to the data. Each switch refetches or reuses the one response (all series come in the same response, so a series switch must not refetch) | Critical | M |
| F39-T02 | Summary | Above the chart: the last value, an arrow (up, down, flat) with `change` and `changePct` from the server, and the line "Return, excl. deposits: +x%" from `performancePct`. A short sentence by direction: "Rising over the last 3 months", "Falling over the last month", "Flat". Hidden numbers show a dash when null | Critical | S |
| F39-T03 | Placement | The Investments hero line (F31, which already uses the history) gains the series switch and range picker. The Assets page net worth card (F30) gets the same component (default series Net worth). No new route | High | S |
| F39-T04 | Notes and tests | A note "N of your money in this range was added by you" when `netContributions` is not zero, from the server figure. The coverage note from D-F43 (`coverage.short`). A single point shows the empty state ("History starts today"). Unit: series pick, direction to colour, null handling. Component: switching series does not refetch, range change refetches with `range=YTD` etc., notes. Playwright at 1440 px and 390 px: touch the chart to inspect, no overflow, the line for a rising fake series is positive coloured and a falling one negative | Critical | M |

New open question **Q14**: do you want a "All assets" series (everything owned, debt not subtracted) next to Net worth, Investments and Assets (fixed assets)? Planned: yes.

**Risk RF-46.** History starts only when the daily snapshot job first ran, so a new or recent account has a short chart. The coverage note explains it. Nothing is invented.
