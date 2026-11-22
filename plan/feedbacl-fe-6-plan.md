# Frontend Plan Addendum 6: Page Titles, Assets Page Rework, Pie Switch, Drag Reorder, Fuller Forms (F24 to F29)

Nov 22, 2026 · @jo

This addendum extends `docs/frontend-plan.md` and follows `plan/feedbacl-fe-5-plan.md` (F21 to F23). It does not replace either. The backend plan is still authoritative for all API contracts.

| Field | Value |
| --- | --- |
| Document | Addendum 6 to the frontend plan: page titles, Assets page, investments pie, wallet reorder, asset forms |
| Scope | Frontend only. No backend change is required (wallet reorder already has `wallets.reorderRequest`) |
| Sources | Written review feedback on the shipped F21 to F23 build (8 items) |
| Status | Planning. F24 to F26 are Ready now. D-F33 to D-F36 are Proposed |

**Verification limits.** The feedback is text only, so the root causes below are **inferred** from reading the code. Every layout, drag or motion task is checked in real Chromium (Playwright) at 1440 px and 390 px (drag also with touch). Never tick them from unit tests alone.

---

## 1. Feedback, mapped to causes

| # | Feedback | Page | Likely root cause (inferred) | Phase |
| --- | --- | --- | --- | --- |
| 1 | Pie chart in the Assets page, per section | Assets | `AssetsScreen` has a net worth line chart only. `PieChart` exists (`shared/charts`) and `walletPieSlices` / `topSlices` already build slice data for Wallets and Investments, but no section on Assets uses one | F27 |
| 2 | Cash and Investments use text buttons ("Wallets", "Open"); use icons like the other sections | Assets | `ManualSection` passes an icon `Button` (`Plus`), but the Cash and Investments `action` props pass `<Button size="sm">` with a text label | F25 |
| 3 | Investments pie: switch between per asset class and per asset name | Investments | `InvestmentsScreen` renders one `PieChart` fed by `topSlices` (top 6 holdings plus Other). There is no category slice builder and no switch | F26 |
| 4 | Assets page: dropdown per broker or exchange | Assets | `accountGroups` already groups investments by wrapper (broker, exchange), but `AssetBreakdownList` renders each group as a static title plus rows. Only the whole section collapses | F25 |
| 5 | Remove the page name on every page | All | Every screen renders its title: `PageHeader` (about 20 screens), plus bare `<h1>` in Home, Assets, Wallets, History. The shell already shows where you are through the nav indicator | F24 |
| 6 | Reorder wallets with drag and drop | Wallets | Reorder is a toggle ("Reorder" / "Done") that shows up and down buttons (`WalletsScreen` `renderAside`, `moveItem`). No pointer drag, and the mobile `WalletStack` is an overlapped deck | F28 |
| 7 | Blank space on Add fixed asset, Add debt, Add money owed | Asset forms | `NewAssetScreen`, `EditAssetScreen` and `AssetDetailScreen` use `<Page width="form">` (1120 px) and `AssetForm` is one stacked column, with a full-width button. Edit wallet uses `width="wide"` and a two-column grid with a sticky preview | F29 |
| 8 | Collapsed section shows "3 items · Bitcoin"; show only the count | Assets | `collapsedSummary` appends `· ${first}`, the first item's name | F25 |

---

## 2. Impact on the existing plan

| Item | Impact |
| --- | --- |
| F7 / F8 and earlier headers | The page name stops being drawn. `PageHeader` stays for the back link and the page action (Add, Mail icon). Tests that look up the heading by role are updated, not deleted |
| F16 (collapsible sections) | `collapsedSummary` loses the name part (item 8). The `section-summary` test id stays |
| D-F18 (investments grouped by broker) | Each broker group becomes collapsible. The grouping rule (`accountGroups`, `wrapperOf`) is unchanged, so the Assets and Investments pages still agree |
| F19 / F21 (wide tier) | The asset forms join Edit wallet and Card style in the `wide` tier. No new tier |
| Wallet reorder (F6, `useReorderWallets`, `moveItem`) | The API call and the optimistic update stay. Only the input changes, from buttons to drag. The buttons stay as the keyboard and screen reader path (D-F35) |
| `plan.md` 5.9 performance budget | Item 6 adds one library. It is measured in F28-T04 (RF-25) |
| `a11y.test.tsx`, `wallets.test.tsx`, `assets.test.tsx`, `breakdown.test.tsx`, `investments.test.tsx`, `width-fill.spec.ts`, `smoke.spec.ts` | Heading, "Wallets" and "Open" link, summary and reorder assertions are updated, not deleted |

### New decisions

| ID | Decision | Status | Recommended |
| --- | --- | --- | --- |
| D-F33 | What "remove the page name" covers | Proposed | Top level and settings pages lose the visible title (Home, Assets, Wallets, Investments, History, Goals, Categories, Settings and its sub-pages, Add and Edit screens). Each keeps an `sr-only` `<h1>` so screen readers and the document outline still work. Detail screens keep their **entity name** (a wallet, an asset, an investment, a goal), because that is content, not a page name. Confirm |
| D-F34 | Pie per section: what is a slice | Proposed | Cash: one slice per wallet. Investments: the same Category / Asset switch as the Investments page (F26). Fixed assets, Money owed, Debts: one slice per item. Manual items have no base currency value from the server, so, as `walletPieSlices` does, only items already in the base currency are drawn (no client FX). If none qualify, the pie is hidden with a one-line note. A section with one item or less shows no pie |
| D-F35 | Drag and drop library | Proposed | `@dnd-kit/core` and `@dnd-kit/sortable` (about 12 KB gzipped, pointer, touch and keyboard sensors, no HTML5 DnD quirks on mobile). The up and down buttons stay, hidden visually until the row is focused, as the non-drag path. Native HTML5 drag was rejected: no touch support |
| D-F36 | Reorder on the mobile wallet deck | Proposed | The overlapped `WalletStack` cannot be dragged sensibly. On mobile, a drag handle appears only in the expanded list (the existing `forceExpanded` state), long-press to start. The "Reorder" button stays on mobile to enter that state. From 1024 px the grid cards are always draggable by a grip handle and the "Reorder" button is removed |
| D-F37 | Asset form layout from 1024 px | Proposed | Left: the form fields in a two-column grid. Right (about 26rem, sticky): a live preview card of the item (icon, name, value, counterparty, due date) fed by the form state, the same way Edit wallet previews. Submit moves into the right column under the preview. Below 1024 px: one column as before, with the Submit button last |

---

## 3. Phases

Run them in order. F24 first, because it touches every screen and shifts every layout check that follows. F26 before F27, because F27 reuses the switch.

## Progress

**F24**
- [x] F24-T01 `PageHeader` without the visible title (sr-only `h1`; back link and action stay)
- [x] F24-T02 Bare `<h1>` screens (Home, Assets, Wallets, History) and the Auth card
- [x] F24-T03 Spacing after the header row is removed (no empty gap at the top)
- [x] F24-T04 Tests (headings by role pass in vitest. `test/e2e/no-page-titles.spec.ts` is written but NOT run: Playwright was skipped by request, so the browser check is still to do)

**F25**
- [x] F25-T01 Cash and Investments actions become icon buttons
- [x] F25-T02 Collapsed summary shows the count only
- [x] F25-T03 Collapsible broker and exchange groups
- [x] F25-T04 Tests (vitest only; Playwright skipped by request, so the 1440 px and 390 px header check is still to do)

**F26**
- [x] F26-T01 Category slice builder (`categorySlices`)
- [x] F26-T02 Shared `SplitSwitch` and the Investments pie toggle
- [x] F26-T03 Tests (vitest only; the Playwright redraw and layout-jump checks were skipped by request and are still to do)

**F27**
- [x] F27-T01 `SectionPie` component and slice builders for manual assets
- [x] F27-T02 Pie in each Assets section
- [x] F27-T03 Tests (vitest only; the Playwright fit and overflow checks were skipped by request and are still to do)

**F28**
- [x] F28-T01 Install dnd-kit and build `SortableList` (`shared/ui/SortableList.tsx`: pointer and keyboard sensors, handle-only drag; no touch sensor needed because the handle is `touch-none`)
- [x] F28-T02 Wallet grid drag from 1024 px (built; actual dragging NOT verified in a browser, Playwright skipped by request)
- [x] F28-T03 Mobile expanded list drag (changed: reorder mode now swaps the overlapped deck for a plain sortable list, because the absolutely positioned deck cannot be dragged sensibly. Not verified on touch)
- [x] F28-T04 Tests and bundle (vitest and `pnpm size` pass, Wallets chunk 16.99 KB gzip of 60. The drag, persistence and touch Playwright checks were skipped by request and are still to do; jsdom cannot drag, so only the handles and move buttons are unit tested) check

**F29**
- [x] F29-T01 Asset screens to the wide tier (new, edit and detail; detail is value card and actions on the left, history on the right)
- [x] F29-T02 Two-column form and live preview (preview hidden below 1024 px, Submit moves under it from 1024 px and stays last on mobile)
- [x] F29-T03 Tests (vitest only; the Playwright width, sticky and 390 px checks were skipped by request and are still to do)

### F24: No page names

| ID | Task | Detail | Priority | Size |
| --- | --- | --- | --- | --- |
| F24-T01 | `PageHeader` | In `shared/ui/PageHeader.tsx` render the `<h1>` as `sr-only` (D-F33). Keep the back link and the `action` slot. When there is no `backToSettings` and no `action`, return only the `sr-only` heading, so no empty row is drawn. Add an `entity` prop (or `visibleTitle`) for the detail screens that keep their name: `WalletDetailScreen`, `AssetDetailScreen`, `InvestmentDetailScreen`, `GoalDetailScreen`, `SharingScreen` | Critical | S |
| F24-T02 | Bare `<h1>` screens | `HomeScreen`, `AssetsScreen`, `WalletsScreen`, `HistoryScreen`: the `<h1 className="text-xl font-medium">` becomes `sr-only`. `WalletsScreen` and `HistoryScreen` keep their action row (Add wallet, filters) aligned right, without the title on the left. `AuthCard` keeps its title: it is the form heading, not a page name | Critical | S |
| F24-T03 | Spacing | Remove `mb-4` from the header row when it has no visible content, and check the top gap of every screen at 1440 px and 390 px so no screen starts with a blank band. `Page` `gap` applies as before | High | S |
| F24-T04 | Tests | Component: each screen still exposes one `h1` by role (`getByRole('heading', {level: 1})`), now hidden visually, and detail screens show the entity name. Update the 12 test files that match a visible title. Playwright: no visible `h1` text on the top level screens, the back link on Profile, Security, Space and Currency still works, no blank band above the first card. Axe: no heading-order regression | Critical | M |

### F25: Assets page, icons, counts and broker dropdowns

| ID | Task | Detail | Priority | Size |
| --- | --- | --- | --- | --- |
| F25-T01 | Icon actions | In `AssetsScreen` the Cash `action` becomes `<Button variant="ghost" size="icon" aria-label="Open wallets" asChild>` with the lucide `Wallet` icon, and the Investments one `aria-label="Open investments"` with `ArrowUpRight` (or `ExternalLink`). Same size and `size-5` icon as the `Plus` buttons. Keep the "Open all N investments" text link under the list, since it is a content link. Tooltip through `title` | Critical | S |
| F25-T02 | Count only | `collapsedSummary` returns `"3 items"`, `"1 item"` or `"Empty"`. The names argument becomes a count (`collapsedSummary(count: number)`), and the three call sites pass `.length`. Keep `data-testid="section-summary"` | Critical | S |
| F25-T03 | Collapsible broker groups | In `AssetBreakdownList`, add `collapsible?: boolean` to the component. When set, each group title row is a button (`aria-expanded`, `aria-controls`) with a chevron, using `Collapsible`. The row shows the group title, its `subtitle` (holdings and share), and its total. Default open for the first group, closed for the rest, to keep the page short (D-F18 order: biggest first). Investments passes `collapsible`. Cash groups (Bank, E-wallet, Cash, Other) get the same treatment since they are the same pattern. Groups with one row stay open and plain | High | M |
| F25-T04 | Tests | Component: Cash and Investments sections show an icon link with an accessible name, no "Wallets" or "Open" text. Unit: `collapsedSummary(0)`, `(1)`, `(3)`. Component: a broker group toggles with click and Enter, collapsed rows are `inert`. Playwright at 1440 px and 390 px: the section header does not wrap, the summary shows no name | Critical | M |

### F26: Investments pie, class or asset

| ID | Task | Detail | Priority | Size |
| --- | --- | --- | --- | --- |
| F26-T01 | Category slices | In `investments/valuation.ts` add `categorySlices(items, label)`: one slice per asset type, from `groupInvestments` (value in the base currency, the type's label as name, in `TYPE_ORDER`). Types with no base value are left out, as `topSlices` does. Money stays as strings and `Decimal` | Critical | S |
| F26-T02 | Switch | New `shared/ui/SplitSwitch` on top of `SegmentedControl`, two options ("By class", "By asset") with an `aria-label`. `InvestmentsScreen` holds the mode, default `By class`, and feeds `PieChart` from `categorySlices` or `topSlices`. The pie `label` and the legend follow the mode. The choice is kept in `sessionStorage` for the session only (RF-23). Below 1024 px the switch sits above the pie | High | M |
| F26-T03 | Tests | Unit: `categorySlices` sums to the portfolio value, orders by `TYPE_ORDER`, skips a type with no base value. Component: the switch changes the legend from asset types to holdings, the default is class. Playwright: the pie redraws on switch, no layout jump of the summary card at 1440 px and 390 px. Reduced motion shows no sweep | Critical | M |

### F27: Pie per Assets section

| ID | Task | Detail | Priority | Size |
| --- | --- | --- | --- | --- |
| F27-T01 | Section pie | New `features/assets/SectionPie.tsx`: a compact `PieChart` (`donut`, `size={120}`, `layout="row"` from 640 px, stacked below), `showAmounts={false}` on narrow screens. Slice builders in `assets/breakdown.ts`: `walletSlices` (reuse `walletPieSlices`) and `manualSlices` (one per item, base currency only, D-F34). Hidden when fewer than 2 slices | Critical | M |
| F27-T02 | Place it in the sections | Add an optional `chart` prop to `Section`, rendered at the top of the open body, above the rows, so a collapsed section stays small. Cash gets the wallet pie, Fixed assets, Money owed and Debts get the item pies, Investments gets the F26 switch and pie (same state shape, its own mode, default `By class`). Net worth line chart stays at the top | High | M |
| F27-T03 | Tests | Unit: `manualSlices` skips other-currency items and sums correctly. Component: a section with one item shows no pie, with three shows a legend. Playwright at 1440 px and 390 px: pies fit their column, no overflow, collapsed sections show no pie. Axe on the legends | Critical | M |

### F28: Wallet drag and drop

| ID | Task | Detail | Priority | Size |
| --- | --- | --- | --- | --- |
| F28-T01 | `SortableList` | `pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`. Build `shared/ui/SortableList.tsx`: `DndContext` plus `SortableContext`, `PointerSensor` (4 px distance), `TouchSensor` (250 ms delay), `KeyboardSensor` with the sortable coordinates, `rectSortingStrategy` for the grid. It calls `onReorder(fromIndex, toIndex)` and reuses `moveItem`. A drag handle (`GripVertical`) with `aria-label="Reorder {name}"`. Announcements through the dnd-kit live region | Critical | M |
| F28-T02 | Grid from 1024 px | `WalletGrid` wraps its items in `SortableList`. Each card gets a grip handle at the top left, and the card link stays clickable (the handle is the only drag source). The "Reorder" button is removed from 1024 px. The existing optimistic `useReorderWallets` mutation is called on drop, a failure shows the existing toast and restores the order. The dragged card lifts (shadow, scale 1.02) and the drop target shows a gap. Reduced motion: no scale, instant settle | Critical | L |
| F28-T03 | Mobile list | Below 1024 px "Reorder" still expands the deck (`forceExpanded`) and each row gets the same handle (D-F36). The up and down buttons are kept for keyboard and screen reader use, visible only on focus (RF-24). Auto scroll while dragging near the edges | High | M |
| F28-T04 | Tests and bundle | Component: keyboard reorder (Space, arrows, Space) calls `onReorder` and the mutation. Unit: `moveItem` unchanged. Playwright (real Chromium, mouse and touch): drag the first wallet to the last place at 1440 px and 390 px, reload, the order persisted. A click on a card still opens it. A failed save restores the order. Measure the gzip size of the Wallets chunk before and after (RF-25) | Critical | M |

### F29: Asset forms use the space

| ID | Task | Detail | Priority | Size |
| --- | --- | --- | --- | --- |
| F29-T01 | Wide tier | In `AssetDetailScreen.tsx` change `NewAssetScreen` and `EditAssetScreen` from `<Page width="form" gap={5}>` to `<Page width="wide" gap={8}>`. Move `AssetDetailScreen` (the detail page, with its settle history) to the wide tier too, with the same two column idea: value card and settle actions on the left, history on the right, so the whole asset area is consistent | Critical | M |
| F29-T02 | Two columns and preview | In `AssetForm`, copy the `EditLayout` grid from `EditWalletScreen` (`grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-10`). Left: the fields, paired in two columns from 1024 px (Name and Icon, Currency and Amount, Counterparty and Due date, Note full width). Right, `lg:sticky lg:top-4`: a live preview card (icon, name, amount in the chosen currency, counterparty, due date), watching the form with `useWatch`, and the Submit button below it (D-F37). Below 1024 px: one column, Submit last and full width. Keep the `data-testid` pattern (`asset-form-layout`, `asset-preview`) | Critical | L |
| F29-T03 | Tests | Component: the preview follows the typed name and amount, and a money field still formats. Create, edit and server error paths (`MANUAL_ASSET_CURRENCY_LOCKED`) still work. Playwright at 1440 px and 1920 px: the content box is wider than 1120 px, no horizontal gap wider than 48 px beside it, the preview stays in view after scrolling. At 390 px: one column, no overflow, Submit reachable above the tab bar. Check all three kinds (fixed asset, debt, money owed) | Critical | M |

---

## 4. Risks

| ID | Type | Risk | Mitigation |
| --- | --- | --- | --- |
| RF-23 | Risk | A pie mode saved in storage shows stale data after the portfolio changes | Only the mode is stored (never data), in `sessionStorage`, wrapped in try and catch. The pie always reads live query data |
| RF-24 | Risk | Hiding the up and down buttons removes the only non-pointer path for some users | The dnd-kit keyboard sensor is the main path, the buttons show on focus and stay in the accessibility tree. Tested with keyboard only in F28-T04 |
| RF-25 | Risk | A new library grows the Wallets chunk and breaks the budget in 5.9 | dnd-kit is code split with the Wallets route, measured before and after, and the limit is stated in F28-T04. Fall back to the buttons if it fails the budget |
| RF-26 | Risk | The drag handle conflicts with the card link, so a tap opens the wallet instead of dragging, or a drag opens it on release | The handle is separate from the link, the link ignores a click that follows a drag, and touch uses a 250 ms press delay. Tested on touch in F28-T04 |
| RF-27 | Risk | Manual items in a foreign currency are missing from the pie, so the pie does not match the section total | The server total is converted and the pie is not (no client FX, 5.2). The pie shows a "N items in other currencies not shown" note, as the wallet pie does, and is hidden when nothing qualifies. A server `baseValue` per item would fix it, and is a request for the backend plan |
| RF-28 | Risk | Removing visible titles hurts orientation, since some screens (Add, Edit) have no other label | Back links and the action stay, the nav indicator shows the section, and the first card or form label names the task. Detail screens keep the entity name (D-F33). Confirm before F24 starts |
| RF-29 | Risk | Removing the titles shifts every layout test and the density spec | F24 is first, and F24-T03 re-checks the top gap on every screen. The other phases measure after it |

---

## 5. Next steps

1. Confirm D-F33 (what the title removal covers) and D-F35 (dnd-kit). D-F34, D-F36 and D-F37 are open to change but have a default.
2. Do F24 first, since it is Ready now and shifts every later check.
3. Do F25, F26, then F27 (it reuses the F26 switch). Then F28 and F29, which are independent.
4. After F29, run the full Playwright suite in a real browser and re-run Lighthouse (F10), since F28 adds a library.
5. Ask the backend plan for a `baseValue` on manual assets (RF-27), so the Assets pies can include foreign currency items.
