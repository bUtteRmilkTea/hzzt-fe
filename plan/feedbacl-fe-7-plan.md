# Frontend Plan Addendum 7: One Combined Assets Pie, Investments Chart Split, Smooth Whole-Card Wallet Drag (F30 to F32)

Nov 22, 2026 · @jo

This addendum extends `docs/frontend-plan.md` and follows `plan/feedbacl-fe-6-plan.md` (F24 to F29). It does not replace either. The backend plan is still authoritative for all API contracts.

| Field | Value |
| --- | --- |
| Document | Addendum 7 to the frontend plan: Assets pie, Investments hero, wallet drag feel |
| Scope | Frontend only, **except** the Investments line (D-F39 needs a backend endpoint that does not exist yet) |
| Sources | Written review feedback on the shipped F24 to F29 build (3 items) |
| Status | Planning. F30 and F32 are Ready now. F31 is Ready for the layout and the pie. Its line chart waits on D-F39 |

**Verification limits.** The feedback is text only, so the root causes below are **inferred** from reading the code. Drag, layout and motion tasks are checked in real Chromium (Playwright) at 1440 px and 390 px, with mouse and touch. Never tick them from unit tests alone. (Addendum 6 was shipped with these checks skipped, so F30 to F32 re-run them for F24 to F29 too, see section 5.)

---

## 1. Feedback, mapped to causes

| # | Feedback | Page | Likely root cause (inferred) | Phase |
| --- | --- | --- | --- | --- |
| 1 | The Assets page should have **one** pie for all assets combined (for example 25% cash, 40% investments, 10% fixed assets, 15% debt, 10% money owed to you). Remove the pie in every section | Assets | F27 put a `SectionPie` in each section. The server already returns every figure for one combined pie in `networth.SummaryDTO`: `cash`, `investments.value`, `fixedAssets`, `liabilities`, `receivables`, all converted to the base currency | F30 |
| 2 | Keep a line graphic on the Investments page. Split that section into a left half (line) and a right half (pie, switchable by class or by asset) | Investments | The hero card has value, P/L and cost on the left and the pie on the right. There is no line. **The API has no portfolio history**: only `GET /spaces/{id}/net-worth/history` exists (net worth, not investments). Confirmed in `api/openapi.yaml` and `../hzzt/docs/swagger.yaml` | F31 |
| 3 | Wallet drag has no animation, and only starts from the grip icon. Make the whole card draggable, drag smoothly, and remove the icon | Wallets | (a) `SortableItem` puts the drag `listeners` on the grip button only (F28-T01). (b) **No animation:** `.stagger-in` uses `animation: row-in ... both` whose keyframes set `transform`. With `fill-mode: both` that animation keeps `transform: translateY(0)` applied after it ends and **overrides the inline `transform` dnd-kit sets**, so neighbours cannot slide and the dragged card does not follow the pointer smoothly. (c) There is no `DragOverlay`, so no lift or drop animation. (d) A card is a `<Link>`, so a native link drag or the click after a drop can fight the sensor | F32 |

---

## 2. Impact on the existing plan

| Item | Impact |
| --- | --- |
| F27 (section pies) | Superseded. `SectionPie`, `manualSlices`, the `chart` prop of `Section`, and the Assets-side Investments `SplitSwitch` are removed. `categorySlices`, `SplitSwitch`, `useSplitMode` stay (the Investments page uses them) |
| D-F34 | Replaced by D-F38 |
| F26 (Investments pie switch) | Kept. It moves into the right half of the new hero (F31) |
| F28 / D-F35 / D-F36 | The grip handle and the "buttons visible on focus" rule change (D-F40). The library (`@dnd-kit`), the mobile reorder list and the `moveItem` mutation stay |
| `assets.layout.test.tsx`, `breakdown.test.tsx`, `walletStack.test.tsx`, `wallets.test.tsx`, `investments.layout.test.tsx` | Pie-per-section, drag handle and hero assertions are updated, not deleted |
| `plan.md` 5.2 | The combined pie uses server figures only. No client sums and no FX |

### New decisions

| ID | Decision | Status | Recommended |
| --- | --- | --- | --- |
| D-F38 | What the combined Assets pie shows | Proposed | Five slices from the summary: Cash, Investments, Fixed assets, Money owed to you, Debt. Each slice is its share of the **sum of the five** (all positive magnitudes), so debt is a slice, as in your example, and the pie is **not** the net worth (which subtracts debt). The legend says "Share of gross total" with a one-line note under it. A zero slice is left out. Server figures only (`allocatePct` for the percentages, no FX). Position: inside the net worth card, right of the value and line on desktop (about 2 fifths), below the line on mobile. Hidden in `CASH_ONLY` mode (one slice only) |
| D-F39 | Where the Investments line gets its data | **Open** | Ask the backend plan for `GET /spaces/{spaceId}/investments/history?range=1M|3M|6M|1Y|ALL`, the same shape as `networth.HistoryDTO` (`points[{date, value, live}]`, `currency`, `changePct`). Build the UI now against a `usePortfolioHistory` hook. Until the endpoint exists the hook returns no points and the chart shows its empty state ("History starts today", live point only). The alternatives are worse: showing **net worth** history on the Investments page would be mislabelled, and a client-side series cannot be rebuilt from lots and prices without history prices. **This needs your answer** |
| D-F42 | Investments line range choices | Done | 1M, 3M, 6M, 12M and All time (your request). The API already accepts `1M`, `3M`, `6M`, `1Y`, `ALL` for net worth, so the new portfolio endpoint (D-F39) should accept the same five values. Send this to the backend plan together with D-F39 |
| D-F43 | Chosen range longer than the data | Done | Show what exists, never an empty chart. If you pick 6M and only 3 months of points exist, the line draws those 3 months and a small note sits under it: "Your data only covers 3 months." The note shows only when the first point is more than 3 days later than the start of the chosen range, never for All time. The picker keeps your choice (6M stays selected). The span is the first to last point date in whole months ("2 weeks" or "5 days" when under a month). A single point shows the empty state with the same note. The server already returns what it has (a new space "returns just the live point"), so this is a display rule only |
| D-F40 | Wallet drag input | Proposed | The whole card is the drag source (no handle, no icon). Mouse: drag after 4 px. Touch: press and hold 200 ms, then drag (so a normal swipe still scrolls the page). A tap or click still opens the wallet, and a click right after a drop is swallowed. Keyboard: the Move up and Move down buttons stay, visible only while focused (the keyboard sensor needs a handle, so it is dropped). The mobile "Reorder" list keeps its toggle (the overlapped deck cannot be dragged), and from 1024 px the grid is always draggable |
| D-F41 | Drag animation | Proposed | A `DragOverlay` shows the lifted card (scale 1.03, a larger shadow, a slight tilt of 0.5 degrees) following the pointer. The original slot keeps its place at 40% opacity. Neighbours slide with dnd-kit's own transform transition (200 ms, ease). Drop animation settles over 220 ms. All of it is instant under reduced motion unless "Always play" is chosen (the same `data-motion` rule as F17) |

---

## 3. Phases

F30 and F32 are independent. F31 can start now, with its line chart held back until D-F39.

## Progress

**F30**
- [x] F30-T01 `assetMixSlices` from the net worth summary (server figures only)
- [x] F30-T02 Combined pie in the net worth card
- [x] F30-T03 Remove the per-section pies (`SectionPie`, `manualSlices`, the `chart` prop, the Assets `SplitSwitch`)
- [x] F30-T04 Tests (vitest only; the Playwright layout check was skipped by request and is still to do)

**F31**
- [ ] F31-T01 Hero layout: summary row, then a left half (line) and a right half (pie with the class and asset switch)
- [ ] F31-T02 `usePortfolioHistory` and the line chart (blocked on D-F39; empty state until the endpoint exists)
- [ ] F31-T03 Short data note (chosen range longer than the data, D-F43)
- [ ] F31-T04 Tests

**F32**
- [ ] F32-T01 Remove the grip handle, make the whole card the drag source
- [ ] F32-T02 Fix `.stagger-in` so it cannot override dnd-kit's transform
- [ ] F32-T03 `DragOverlay`, lift, neighbour slide and drop animation
- [ ] F32-T04 Click, touch and link behaviour (no native link drag, no click after a drop, 200 ms touch hold)
- [ ] F32-T05 Tests in real Chromium (mouse and touch) and the bundle check

### F30: One combined pie on the Assets page

| ID | Task | Detail | Priority | Size |
| --- | --- | --- | --- | --- |
| F30-T01 | Slice builder | In `assets/breakdown.ts` add `assetMixSlices(summary)`: Cash (`cash`), Investments (`investments.value`), Fixed assets (`fixedAssets`), Money owed to you (`receivables`), Debt (`liabilities`), in that order, as `PieSlice` with money strings. Drop any slice that is zero or absent. Percentages come from `allocatePct` over the five amounts, so they add to 100.00 (D-F38). No client sums, no FX | Critical | S |
| F30-T02 | Pie in the net worth card | In `AssetsScreen` the net worth card becomes a two-part layout from 1024 px: left (about 3 fifths) the value, the change and the line chart as now, right (about 2 fifths) a `PieChart` (`donut`, `draw`, `layout="row"`, `showAmounts` on) labelled "Share of gross total" with a one-line note "Debt counts as its own slice. Net worth subtracts it". Below 1024 px the pie sits under the line. Hidden when fewer than 2 slices (this includes `CASH_ONLY`) | Critical | M |
| F30-T03 | Remove the section pies | Delete `SectionPie.tsx`, `manualSlices` (and its test), the `chart` prop of `Section`, the `cashSlices` and `invSlices` code and the Assets-side `SplitSwitch` and `useSplitMode` use. Keep `categorySlices`, `SplitSwitch` and `useSplitMode` (Investments page). Sections go back to header plus rows | Critical | S |
| F30-T04 | Tests | Unit: `assetMixSlices` order, skips zero and absent, adds to 100.00, debt is a slice. Component: one `pie-chart` on the page, none inside any section region, the legend lists the five names, no pie in cash-only mode. Replace the F27 section-pie tests. Playwright at 1440 px and 390 px: the card has line and pie side by side from 1024 px, stacked below, no overflow | Critical | M |

### F31: Investments hero, line on the left and pie on the right

| ID | Task | Detail | Priority | Size |
| --- | --- | --- | --- | --- |
| F31-T01 | Hero layout | In `InvestmentsScreen` the `portfolio-summary` card keeps the value, P/L and cost as a top row. Under it, a two-column grid from 1024 px (`lg:grid-cols-2`, equal halves): left, the line chart with a range picker of five choices, labelled **1M, 3M, 6M, 12M and All time** (they map to the API ranges `1M`, `3M`, `6M`, `1Y`, `ALL`; default 1M). Use a `SegmentedControl` above the line, which scrolls sideways on narrow screens instead of wrapping; right, the `SplitSwitch` and the pie with its legend (F26 behaviour unchanged, default By class). Below 1024 px the halves stack, line first. Test ids: `portfolio-line`, `portfolio-pie` | Critical | M |
| F31-T02 | Line data (D-F39) | `usePortfolioHistory(spaceId, range)` in `investments/hooks.ts` (`range` is `1M | 3M | 6M | 1Y | ALL`), same shape and query-key style as `useNetWorthHistory`. It calls the new endpoint once the backend adds it, and until then returns an empty series. The chart uses `LineChart` (`draw`, trend colour) with `label="Portfolio value over the last month"`. With no points it shows the empty text "History starts today" and the live value as a single point. **Do not feed it net worth history** | High | M |
| F31-T03 | Short data note | Add `coverage(points, range, today)` in `investments/portfolioHistory.ts`: returns `{ short: boolean, spanLabel: string }`. `short` is true when the range is not `ALL` and the first point date is more than 3 days after `today` minus the range (1M, 3M, 6M, 12M). `spanLabel` is the first-to-last span ("3 months", "1 month", "2 weeks", "5 days"). `PortfolioLine` renders `Your data only covers {spanLabel}.` under the chart (`data-testid="portfolio-coverage"`, `text-xs text-label-secondary`, `role="note"`), and never shortens the series or changes the selected range. Use date-fns for the maths, no timezone drift (dates are UTC days) | High | S |
| F31-T04 | Tests | Unit: `coverage` for 3 months of data with 6M selected (short, "3 months"), 3 months with 3M (not short), 3 months with ALL (not short), a first point 2 days late (not short), 20 days of data with 1M (short only if over 3 days late, label "2 weeks"), one point. Component: the hero has a line half and a pie half, the switch still changes the legend, the range picker shows exactly 1M, 3M, 6M, 12M and All time, 12M sends `range=1Y` and All time sends `range=ALL`, and each choice refetches and redraws the line. Playwright at 1440 px and 390 px: halves side by side from 1024 px with equal widths within 8 px, stacked below, no overflow, the pie does not jump when the line loads (skeleton height matches) | Critical | M |

### F32: Wallets drag the whole card, smoothly

**The drag animation is the main point of this phase, not a nice-to-have.** It is built in F32-T02 (remove the CSS that blocks it) and F32-T03 (lift, neighbours sliding, drop settle), and F32-T05 proves it in a real browser: a neighbour's `transform` must change while dragging, the lifted card must be scaled, and the drop must settle instead of snapping.

| ID | Task | Detail | Priority | Size |
| --- | --- | --- | --- | --- |
| F32-T01 | No handle | In `shared/ui/SortableList.tsx` move `attributes` and `listeners` from the grip button to the `<li>`, delete the button and the `GripVertical` import, and remove the `label` prop (the item is named by its content). Set `touch-action: manipulation` on the item (not `none`, so the page still scrolls). The `KeyboardSensor` goes (D-F40): keyboard users use the Move buttons | Critical | S |
| F32-T02 | Fix the animation clash | In `globals.css` the `.stagger-in` rule must not keep a `transform` after it ends. Either change its fill mode to `backwards` (the delay still hides the item until it plays), or animate `translate` instead of `transform`, so dnd-kit's inline `transform` is never overridden. Check every user of `STAGGER` (lists, cards) still eases in. This is the root cause of "no animation" | Critical | S |
| F32-T03 | Drag animation (D-F41) | Add `DragOverlay` to `SortableList`, with a `renderOverlay(id)` prop so the overlay is the same card. The overlay gets `scale(1.03) rotate(0.5deg)` and `shadow-sheet`, the source slot stays at `opacity-40`. Keep dnd-kit's `transition` on neighbours (200 ms ease) and set `dropAnimation` to 220 ms. Under reduced motion all of it is instant (read `data-motion` the way `useSpring` does) | Critical | M |
| F32-T04 | Click, touch and links | Sensors: `MouseSensor` (4 px distance) and `TouchSensor` (200 ms delay, 8 px tolerance). Set `draggable={false}` and `-webkit-user-drag: none` on the card `<Link>` so the browser does not start its own link drag. Ignore the click that follows a drop (a short flag cleared on the next tick), so a drop never opens the wallet. Auto scroll stays on near the screen edges | Critical | M |
| F32-T05 | Tests and bundle | Component: no element named "Reorder {name}" exists, the Move buttons still call the mutation. Unit: the `stagger-in` rule does not leave a `transform` (computed style after the animation ends is `none`). Playwright (real Chromium, mouse and touch, 1440 px and 390 px): press anywhere on a card and drag it to the last place, a neighbour slides while dragging (its `transform` changes, and it eases rather than jumping), the lifted card is scaled and shadowed, the drop settles over about 220 ms and is not an instant snap, the order persists after reload, a plain click still opens the wallet, a drop does not navigate, a vertical swipe on touch scrolls the page. `pnpm size` still passes | Critical | M |

---

## 4. Risks

| ID | Type | Risk | Mitigation |
| --- | --- | --- | --- |
| RF-30 | Risk | The Investments line has no data source, so F31-T02 cannot show real history | D-F39: ask the backend for a portfolio history endpoint, and show an honest empty state until then. Never substitute net worth |
| RF-31 | Risk | Dragging from anywhere blocks page scroll on touch | The touch sensor needs a 200 ms hold with an 8 px tolerance, and the item uses `touch-action: manipulation`. A swipe scrolls, a hold drags. Tested on touch in F32-T05 |
| RF-32 | Risk | The click after a drop opens the wallet | F32-T04 swallows that click, and F32-T05 checks it |
| RF-33 | Risk | A pie with debt as a slice is read as net worth | The legend title says "Share of gross total" and the note says net worth subtracts debt (D-F38) |
| RF-34 | Risk | Changing `.stagger-in` breaks the entry animation of other lists | F32-T02 checks every `STAGGER` user, and the motion specs (`layout-motion`, `motion-audit`) are re-run |
| RF-35 | Risk | Removing the keyboard sensor drops an accessible path | The Move up and Move down buttons stay in the accessibility tree and show on focus (RF-24). Tested with the keyboard only |
| RF-37 | Risk | The note is read as an error, or the chart looks wrong with few points | The chart still draws every point it has, the note is small and neutral, and a single point shows the empty state with the same note |
| RF-36 | Risk | The summary has no per-item data, so "the pie lists what is in each slice" is not possible | The pie is the five asset groups only. The sections below already list the items |

---

## 5. Next steps

1. **Answer D-F39.** The Investments line needs a backend portfolio history endpoint. Say whether to (a) add it to the backend plan and ship the empty state meanwhile (recommended), or (b) leave the line out for now.
2. Do F30 and F32 first, since both are Ready now and independent. Do F31 next (layout and pie now, line when D-F39 is answered).
3. Playwright was skipped for F24 to F29. After F32, run the full Playwright suite in a real browser once, and fix what it finds, before merging the F24 to F32 PRs.
4. After F32, re-run `pnpm size` and Lighthouse (F10).
