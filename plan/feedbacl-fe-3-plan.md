# Frontend Plan Addendum 3: Dead Space, Real Motion, Goals and Navigation Fixes (F15 to F17)

Nov 21, 2026 · @jo

This addendum extends `docs/frontend-plan.md` and follows `plan/feedbacl-fe-2-plan.md` (F11 to F14). It does not replace either. Section numbers refer to the main frontend plan. The backend plan is still authoritative for all API contracts.

| Field | Value |
| --- | --- |
| Document | Addendum 3 to the frontend plan: layout, motion, bug and navigation fixes |
| Scope | Frontend only. No backend change is required, except where a task is marked Blocked |
| Sources | Written review feedback on the shipped F11 to F14 build (8 items, no recording) |
| Status | Planning. F15 is Ready now |

**Verification limits.** The feedback is text only, so the root causes below are **inferred** from reading the code, not observed. Each fix starts with a repro at 1440 px and 360 px. The Playwright specs are written but run locally only (decision 6 of `feedback-fe-plan.md`).

---

## 1. Feedback, mapped to causes

| # | Feedback | Page | Likely root cause (inferred) | Phase |
| --- | --- | --- | --- | --- |
| 1 | Add investment still has many blank areas | Add investment | F13-T05 made two columns, but the form tier is capped at 960 to 1120 px and the summary rail is echo-only (D-F17), so both columns are short | F15 |
| 2 | Charts, pie, analytics and numbers appear instantly, with no line draw and no count up or down | All | F14-T06 animates `<Amount>`, but the charts do not replay on mount, tab change or data load, or `prefers-reduced-motion` is on in the reviewer's OS. The count also never runs down | F16 |
| 3 | No goals on Home | Home | `QuickActions` in `features/dashboard/cards.tsx` only renders a "Goals" link. F14-T03 placed a goals tile, but it shows a label only, as noted in F11 findings | F15 |
| 4 | Wallet card in wallet detail is too big, with blank space left and right | Wallet detail | `WalletCard` uses `aspect-[1.7/1] w-full`, so it grows with the container while the rest of the page is a narrow column | F15 |
| 5 | Cancelling Transfer in wallet detail goes to History | Wallet detail | Transfer is a `Link` to `/s/$spaceId/transactions/new`, and `AddTransactionSheet.close()` always navigates to `/history`. The origin is lost | F15 |
| 6 | History list is too big, pie too small, blank space under the pie | History | The F12-T04 summary rail has a small donut and no content below it, and rows are tall | F15 |
| 7 | Assets investments are not grouped by broker or exchange | Assets | `AssetBreakdownList` is fed a flat list. `InvestmentView.accountId` is still an unused seam (`types.ts`). Wrapper grouping exists on the Investments page only (S5) | F15 |
| 8 | Sidebar highlight should glide, the right drawer should slide in, smooth scroll | Shell | `NavLink` sets `[&.active]:bg-surface-3` per item, so the highlight jumps. `SheetShell` has no horizontal slide on desktop. No `scroll-behavior` is set | F17 |

---

## 2. Impact on the existing plan

| Item | Impact |
| --- | --- |
| Money rule (5.2) | Count down uses the same `decimal.js-light` interpolation as count up. Never `Number()`. The final frame is the exact server string |
| Hide amounts (F1) | While hidden, no digit may appear at any frame, in either direction |
| Reduced motion (D-F15) | Still instant. F16 adds a visible debug line in Settings so a reviewer can tell why motion is off |
| Performance budget (5.9) | No new library. Sliding indicator and drawer slide are CSS plus the existing `motion` package |
| D-F17 | Open item. Add investment stays echo-only. F15-T01 fills space with layout, not computed totals |
| F10 | Re-measure Lighthouse after F16 and F17 |

### New decisions

| ID | Decision | Status | Recommended |
| --- | --- | --- | --- |
| D-F18 | Broker or exchange grouping source | **Open** | Group by `accountId` when present, otherwise by the wrapper field already used on Investments (S5). One shared `groupByAccount` helper for both pages. Confirm backend P18 status (RF-09) |
| D-F19 | Where Transfer lives | Proposed | Keep the route, but pass a `returnTo` search param. Close returns to `returnTo`, else History |
| D-F20 | Replay rule for charts | Proposed | A chart animates when it first enters the viewport, and again when its range or data key changes, not on every re-render |
| D-F21 | Sidebar highlight | Proposed | One absolutely positioned indicator that translates between items with a spring, not a per-item background |
| D-F22 | Smooth scroll | Proposed | `scroll-behavior: smooth` on `html`, disabled under reduced motion, plus anchor and "back to top" only. No scroll hijack library |

---

## 3. Phases

Run them in order. F16 consumes the F15 layout and F17 is independent of F15 and F16 except for the reduced-motion hook.

## Progress

Tick a task only after tests pass and the app starts. Added by the build loop; the tables below are unchanged.

**F15**
- [ ] F15-T01 Add investment fill
- [ ] F15-T02 Home goals
- [ ] F15-T03 Wallet card size
- [ ] F15-T04 Transfer cancel
- [ ] F15-T05 History density
- [ ] F15-T06 Assets grouping
- [ ] F15-T07 Tests

**F16**
- [x] F16-T01 Motion audit (see the audit result below)
- [x] F16-T02 Count up and down
- [x] F16-T03 Line draw everywhere
- [x] F16-T04 Pie, donut and bars
- [x] F16-T05 Analytics and Home (bars and rings grow on Categories, Investments and Goals. The Home goals card itself is F15-T02, which must use the same `useGrow` hook)
- [x] F16-T06 Tests (unit tests pass, and `test/e2e/motion-audit.spec.ts` passes in a REAL Chromium, run locally)

**F17**
- [ ] F17-T01 Sliding nav indicator
- [ ] F17-T02 Drawer slide
- [ ] F17-T03 Smooth scroll
- [ ] F17-T04 Tests

---

### F15: Layout, goals, transfer and grouping fixes

**Goal:** Remove the dead space on the five screens named in the feedback, show goals on Home, fix the Transfer cancel route and group Assets investments by broker or exchange. **Depends on:** F11 to F14 · No backend, unless D-F18 needs P18 · **Size:** Large

| ID | Task | Technical approach | Pri | Size |
| --- | --- | --- | --- | --- |
| F15-T01 | Add investment fill | Raise the form tier cap on this screen to the wide tier. Make the form and the preview rail a 7 and 5 column split at 1024 px and above. The rail echoes name, symbol, icon, type, wrapper and the typed numbers as plain strings only (D-F17). Below the echo, add a "Recent investments" list (top 3) so the rail is never empty. The Add button stays sticky | High | M |
| F15-T02 | Home goals | Replace the label-only tile with a real Goals card: up to 3 goals, each with a name, a progress bar, the saved and target `Amount`, and a "View all" link. Empty state: one line and an "Add goal" button. Reuse the goals query already used by the Goals screen. Remove the duplicate `QuickActions` link when the card shows | Critical | M |
| F15-T03 | Wallet card size | On the wallet detail screen, cap the card at `max-w-sm` (about 384 px) and lay it out beside the balance, actions and mini stats at 1024 px and above (card on the left, details on the right, both inside the Page container). On phones the card keeps full width but loses `aspect-ratio` growth above 480 px. Add a `size` prop (`default`, `compact`) to `WalletCard` rather than a one-off class | Critical | M |
| F15-T04 | Transfer cancel | Add `returnTo` (a validated internal path) to the transactions route search schema. Wallet detail passes it with the Transfer link. `AddTransactionSheet.close()` navigates to `returnTo` when present and valid (starts with `/s/`), else History. The same applies after a successful save. Reject external URLs | Critical | S |
| F15-T05 | History density | Cut row height (about 56 to 44 px at 1024 px and above, smaller padding, one line for the note). Widen the summary rail to about 360 px. Make the category donut fill the rail width (about 220 px), and place a ranked category list with share bars below it, so there is no blank space. The rail stays sticky and never scrolls on its own | High | M |
| F15-T06 | Assets grouping | Add `groupByAccount` in `features/assets/breakdown.ts`, following D-F18. The Investments section shows one `Collapsible` header per broker or exchange (name, holdings count, total, share). Holdings sit under it in hairline rows. The list stays capped at 5 holdings per group with an Open link. Ungrouped holdings go under "Other" last. Totals use `Decimal` | Critical | M |
| F15-T07 | Tests | Component: goals card shows 3 goals and the empty state. `returnTo` accepts `/s/...` and rejects `https://...`. Unit: `groupByAccount` sums, ordering and the "Other" bucket. Playwright: Transfer then Cancel returns to the wallet at 1440 px and 360 px | Critical | M |

**Acceptance criteria**

- No visible blank block wider than 48 px on Add investment, Wallet detail or History at 1440 px.
- Home shows goals when any exist, and an empty state when none exist.
- Cancelling or saving a Transfer started from a wallet returns to that wallet.
- Assets Investments groups by broker or exchange, with a total for each group.

---

### F16: Motion that is visible

**Goal:** Make the charts and numbers visibly animate, in both directions, on every screen. **Depends on:** F11, F14 · No backend · **Size:** Medium

| ID | Task | Technical approach | Pri | Size |
| --- | --- | --- | --- | --- |
| F16-T01 | Motion audit | List every chart and number (Home, History rail, Assets, Wallets, Investments, Goals, Analytics) and mark which of F11-T04 to T06 it uses. Reproduce "no animation" with reduced motion off, to separate a missing hook from an OS setting. Output a table in this file | Critical | S |
| F16-T02 | Count up and down | `<Amount animate>` runs from the previous value to the new one, so a decrease counts down. The first view still counts from zero. Duration scales with the delta (400 to 900 ms). The final frame is the exact string. No animation while hidden | Critical | M |
| F16-T03 | Line draw everywhere | `LineChart draw` on every line chart, triggered by an in-view observer (D-F20) and replayed on range change. Order: line draws, then area fade, then end-dot. Duration about 900 ms, ease-out | Critical | M |
| F16-T04 | Pie, donut and bars | Donut slices sweep clockwise from 12 o'clock with a 60 ms stagger. Bars grow from the baseline. Re-run when the data key changes, not on hover or resize | High | M |
| F16-T05 | Analytics and Home | Apply T02 to T04 to Analytics, the History rail, the Home goals progress bars (bar fills from 0) and the Wallets total. One hero number per region stays the rule (F11-T07), but its delta may also tick | Medium | S |
| F16-T06 | Tests | Unit: interpolation down ends at the exact string. A hidden-amount DOM check at several frames in both directions. Component: a line chart gets `pathLength` and a dashoffset that goes 1 to 0. Playwright with reduced motion off: the line `stroke-dashoffset` is not 0 right after load | Critical | M |

#### F16-T01 audit result (real Chromium 1440 px, fake API with data, run `test/e2e/motion-audit.spec.ts`)

| Condition | Result |
| --- | --- |
| Reduced motion **off** | Every page animates: numbers count up (Home, History, Wallets, Assets, Investments, Categories), the line draws (Home, Assets), pies and donuts sweep, bars grow |
| Reduced motion **on** | Nothing animates anywhere. This is by design (D-F15), and it is the most likely reason the motion was reported missing, because Windows with "Animation effects" off reports reduced motion to the browser |
| Cards below the fold | Real gap found: they animated on mount, so they had finished before the user scrolled to them. Fixed by D-F20 (`useInView`) |
| Progress bars and rings | Real gap found: they were drawn at their final width on first paint, so there was nothing to animate. Fixed by `useGrow` |
| Home in e2e | The fake API returned no history, overview, breakdown or analytics, so the Home charts never rendered in any e2e run. The fake now serves them. This also exposed two layout bugs, fixed here: the overview tiles were too narrow for the amount, and the screen-reader tables in the charts widened the page |

What F16 changed: `useInView` (charts and counters wait until seen), `useGrow` (bars and rings grow), count down and delta-scaled duration, and a Settings control (Animations: Follow system or Always play) that says whether the OS is silencing motion. The e2e suite had 24 failing specs before this work (never run in a browser) and 17 after. The remaining 17 are unrelated to motion and are listed in the PR.


**Acceptance criteria**

- A new value that is smaller than the old one counts down, visibly, over under a second.
- Every chart on every screen animates once when first seen, and again when its range or data changes.
- With `prefers-reduced-motion`, everything is instant and a note in Settings says so.

---

### F17: Navigation and scroll motion

**Goal:** Make the sidebar highlight glide, slide the right drawer in, and smooth the scroll. **Depends on:** F11-T07 (motion tokens) · No backend · **Size:** Small-Medium

| ID | Task | Technical approach | Pri | Size |
| --- | --- | --- | --- | --- |
| F17-T01 | Sliding nav indicator | In `AppShell`, render one indicator element behind the nav list. Measure the active item with a ref (`offsetTop`, `offsetHeight`) and animate `translateY` and height with the existing `motion` spring. Going from Home to Assets passes smoothly through History and Wallets, and no item is ever left without a highlight, because the indicator is one continuous element. Items keep only a text colour change. Do the same horizontally for the mobile tab bar. Re-measure on resize and when the sidebar collapses (`xl` breakpoint) | Critical | M |
| F17-T02 | Drawer slide | In `SheetShell` at 1024 px and above, animate the desktop drawer `translateX(100%)` to `0` on open and back on close (about 280 ms, ease-out), with the overlay fading in. Keep the mobile bottom sheet as is. Keep focus trap and Escape. Use CSS `data-state` keyframes, so no extra library | High | S |
| F17-T03 | Smooth scroll | `html { scroll-behavior: smooth }` inside `@media (prefers-reduced-motion: no-preference)`. Add `scroll-padding-top` for the header. Reset the scroll to the top on route change without a long glide (use `behavior: 'instant'`) | Medium | S |
| F17-T04 | Tests | Component: the indicator moves to the active item on route change. Playwright: after clicking Assets from Home, the indicator box passes through the History and Wallets positions (sample three frames). The drawer's `transform` is not `none` shortly after opening. Reduced motion: both are instant | High | M |

**Acceptance criteria**

- Moving between tabs shows one highlight that travels, with no snap and no flicker of an unhighlighted state.
- The right drawer visibly enters from the right edge.
- Scrolling to an anchor is smooth, and instant with reduced motion.

---

## 4. Risks and open items

| ID | Type | Description | Mitigation |
| --- | --- | --- | --- |
| RF-10 | Risk | The reviewer may have `prefers-reduced-motion` on, which makes all motion instant, so F14 looked unanimated | F16-T01 checks this first, and F16-T06 asserts motion with it off |
| RF-11 | Risk | The sliding indicator measures the wrong box when the sidebar collapses or fonts load late | F17-T01 re-measures on resize and after `document.fonts.ready` |
| RF-12 | Risk | `returnTo` is an open-redirect vector | F15-T04 accepts only paths that start with `/s/` and rejects any scheme or `//` |
| RF-13 | Risk | Grouping by broker depends on data the backend may not return (RF-09) | D-F18 falls back to the wrapper field, then "Other" |
| QF-03 | Open | Is backend P18 (investment accounts) live, so `accountId` is real? | Confirm before F15-T06, or use the wrapper fallback |
| QF-04 | Open | Should goals on Home show only active goals, or also completed ones? | Default to active only |

## 5. Recommended order

1. Confirm QF-03 and D-F18.
2. Start F15-T04 and F15-T03 first. They are the smallest and the most visible bugs.
3. Run F16-T01 early, so we know whether the "no animation" report is a code gap or an OS setting.
4. Do F17 last. It touches the shell and every page, so run the full test suite after it.
