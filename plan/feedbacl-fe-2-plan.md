# Frontend Plan Addendum: Motion, Layout and Page Fixes (F11 to F13)

Nov 21, 2026 · @jo

This addendum extends `docs/frontend-plan.md`. It does not replace it. Section numbers refer to that document. The backend plan is still authoritative for all API contracts.

| Field | Value |
| --- | --- |
| Document | Addendum to the frontend plan: polish and layout-fix phases |
| Scope | Frontend only. No backend change is required, except where a task is marked Blocked |
| Sources | Monveo mobile screenshots (inspo, static) and a 60 s desktop screen recording of the current web app (1918 px wide) |
| Status | Planning. F11 is Ready now |

**Verification limits.** The recording is desktop only, so every fix must also be checked at 360 px. The recording never opens a single investment's detail page, so F13-T04 is planned from the existing plan, not from observation.

---

## 1. What we take from the inspo

The Monveo screenshots are static, so the animation direction comes from the brief. The density comes from the screenshots.

| Inspo aspect | What we take | What we do not copy |
| --- | --- | --- |
| Number going up | One hero number per screen region counts up once, then stays still | Counting on every row, which is noise |
| Drawn line | The net-worth line draws left to right, then its area fades in. Bars grow from the baseline. Donuts sweep in | Anything looping or decorative |
| Filled space, not crowded | Every card has one number, one visual and one action. The same radius and gap are used everywhere. Cards fill their container width | The single-column phone stack on a 1918 px screen |

---

## 2. Findings from the recording

**Observed** means seen in the recording. **Inferred** means read from the UI.

| Page | Observed | Likely root cause (inferred) |
| --- | --- | --- |
| All | Content widths are inconsistent: Home, History and Wallets run about 1400 px, Assets and Investments about 1000 px, and Add investment about 660 px. All are centred with dead margins | Each page sets its own max-width. This is the open question QF-02, answered by accident |
| History | The "sidebar" is the permanent Filters panel, about 230 px wide. It has its own scrollbar, scrolls separately from the page, and sits behind a blank gap. Period chips wrap onto 5 rows | Filters are rendered inline instead of as a panel or sheet, which the reference screenshot (`filter_history`) does with an Apply button |
| Assets | Cards sit on a row-aligned grid, so expanding Investments leaves a large hole under Cash. There is no chart on the net-worth card | Grid cells stretch to the tallest neighbour |
| Investments | The pie is lonely in a wide card with the legend stacked below it. Each account (Bybit, ajaib and so on) has a roughly 60 px white pie that dominates its header. Cards are nested three deep. The slices are all greys | Unflattened nesting. The grey donut is a token choice that is hard to read |
| Add investment | A single narrow column. The 24-emoji grid plus the "type any emoji" field takes about a third of the form. The Add button was not visible without scrolling | One field per row and no sticky footer |
| Home | Switching the net-worth range to 6M shows an empty box. The Goals tile is an empty box with only a label | There is no loading or empty state shaped like the content |

**Not in the plan.** Account grouping and "Set target" on Investments appear in the recording. That looks like backend P18, which the plan lists as Backlog. It is treated as built outside the plan until confirmed.

---

## 3. Impact on the existing plan

| Item | Impact |
| --- | --- |
| Money rule (5.2) | Count-up must not use `Number()`. Interpolate with `decimal.js-light` and make the final frame the exact server string |
| Hide amounts (F1) | While hidden, no digit may appear in the DOM at any frame of the animation |
| F9 "no layout shift" | Counting numbers need `tabular-nums` and a reserved width |
| Performance budget (5.9) | Roughly 2 KB extra, using `requestAnimationFrame` and CSS, with no new library |
| QF-02 | Recommend a wider responsive layout with per-page layouts, not a two-pane view everywhere |
| F10 | Stays in Review. Re-measure Lighthouse after F11 |

### New decisions

| ID | Decision | Status | Recommended |
| --- | --- | --- | --- |
| D-F14 | Desktop layout (resolves QF-02) | **Open** | Wide responsive layout with two width tiers. A summary rail on History only. A true two-pane view would add about a phase |
| D-F15 | Motion spec | Proposed | Count-up about 700 ms, line draw about 900 ms, one hero number per region, no animation library, instant under reduced motion |
| D-F16 | Desktop filter pattern | Proposed | Right side panel at 1024 px and above, Vaul sheet below, with Apply and Clear in a sticky footer |
| D-F17 | Add-investment preview | **Open** | Echo-only rail with no computed totals, because 5.2 forbids client-side totals. A computed preview needs a backend preview endpoint |

---

## 4. Phases

Run them in order. F12 and F13 both consume the F11 primitives.

## Progress

Tick a task only after tests pass and the app starts. Added by the build loop; the tables below are unchanged.

**F11**
- [x] F11-T01 Page container
- [x] F11-T02 TwoColumn
- [x] F11-T03 Collapsible
- [x] F11-T04 <Amount animate>
- [x] F11-T05 Line draw
- [x] F11-T06 Bars and donut
- [x] F11-T07 Rules
- [x] F11-T08 Tests (unit tests for exact `134.26` and hidden-amount DOM at several frames pass; the Playwright spec `test/e2e/layout-motion.spec.ts` is written but NOT run: Chromium system libs are missing locally, so run `pnpm test:e2e` once on a machine with a browser)

**F12**
- [x] F12-T01 History toolbar
- [x] F12-T02 Filter panel
- [x] F12-T03 Active filter chips
- [x] F12-T04 Fill the width
- [x] F12-T05 Assets layout
- [x] F12-T06 Collapsed summaries
- [x] F12-T07 Tests (unit and component tests pass; the Playwright specs `assets-layout`, `history-desktop` are written but NOT run: Chromium system libs are missing locally)

**F13**
- [ ] F13-T01 Portfolio hero
- [ ] F13-T02 Flatten nesting
- [ ] F13-T03 Group columns
- [ ] F13-T04 Detail screen
- [ ] F13-T05 Add form layout
- [ ] F13-T06 Summary rail
- [ ] F13-T07 Tests


### F11: Layout and motion foundation

**Goal:** Fix widths and card expansion at the root, and add the animation primitives. **Depends on:** F1, F9 · No backend · **Size:** Medium

| ID | Task | Technical approach | Pri | Size |
| --- | --- | --- | --- | --- |
| F11-T01 | Page container | `shared/ui/Page` with two tiers (`wide` max 1200, `form` max 960). Adds `--page-max` and `--gutter` tokens. Replaces every per-page max-width | Critical | M |
| F11-T02 | TwoColumn | Two independent flex columns at 1024 px and above, stacked below. Expanding a card never stretches the other column | Critical | S |
| F11-T03 | Collapsible | `grid-template-rows: 0fr to 1fr` height transition, so no measuring. Instant under reduced motion | High | S |
| F11-T04 | `<Amount animate>` | Decimal interpolation over about 700 ms, once on first view and again when the value changes. The final frame is the exact string. No animation while hidden | Critical | M |
| F11-T05 | Line draw | `LineChart` `draw` prop: `pathLength=1` with the dashoffset going from 1 to 0, then an area fade-in and an end-dot. Redraws on range change. Adds a skeleton and a single-point state | High | M |
| F11-T06 | Bars and donut | Bars scale up from the baseline with a 40 ms stagger. Donut slices sweep in. The centre count uses T04 | Medium | S |
| F11-T07 | Rules | Add the motion tokens and a "one hero number per region" rule to 5.6 and Appendix B | Medium | S |
| F11-T08 | Tests | Interpolation ends at exactly `134.26`. A hidden-amount DOM check at several frames. A Playwright check that expanding one card leaves its neighbour's bounding box unchanged | Critical | M |

**Acceptance criteria**

- Expanding any card changes no pixel of the card in the other column.
- A hidden amount never exposes a digit mid-animation.
- All motion is instant under `prefers-reduced-motion`.
- The bundle stays within the 5.9 budget.

---

### F12: History and Assets

**Goal:** Replace the permanent filter column and remove the dead space caused by card expansion. **Depends on:** F11 · **Size:** Medium

| ID | Task | Technical approach | Pri | Size |
| --- | --- | --- | --- | --- |
| F12-T01 | History toolbar | Search, a period dropdown, and a Filters button with an active-count badge replace the permanent panel | Critical | M |
| F12-T02 | Filter panel | A right side panel at 1024 px and above, a Vaul sheet on mobile. Sticky Apply and Clear footer, as in the reference. Reuses the F5-T04 contents | Critical | M |
| F12-T03 | Active filter chips | A removable-chip row under the search field | High | S |
| F12-T04 | Fill the width | Rows show a wallet column at 1024 px and above. At 1280 px and above a sticky summary rail shows in and out totals and a category donut | Medium | M |
| F12-T05 | Assets layout | A full-width net-worth hero with a count-up and a line draw using the F9-T06 chart. Below it, `TwoColumn`: Cash, Fixed assets and Debt on the left, Investments and Money owed on the right | Critical | M |
| F12-T06 | Collapsed summaries | Each collapsed section shows its item count and top item. The inline investment list is capped at 5 with an Open link | High | S |
| F12-T07 | Tests | Expanding Investments leaves Cash unchanged. The filter URL survives a reload | Critical | M |

**Acceptance criteria**

- The History filters never scroll separately from the page.
- Assets has no dead block under any collapsed or expanded card.
- A filtered view survives a copy-paste of its URL into a new tab.

---

### F13: Investments, detail and add form

**Goal:** Flatten the investment screens and make the add form fit the desktop. **Depends on:** F11, F12 · **Size:** Medium-Large

| ID | Task | Technical approach | Pri | Size |
| --- | --- | --- | --- | --- |
| F13-T01 | Portfolio hero | Value (count-up) and P/L on the left, a donut with a horizontal legend on the right, in one row. Slice colours are a token ramp, not greys. The list shows the top 6 plus "Other" | Critical | M |
| F13-T02 | Flatten nesting | One card level per type. Accounts become header rows with value, share and Set target. Holdings are hairline-divided rows. Replace the roughly 60 px pies with a compact target-versus-actual ring or bar | Critical | L |
| F13-T03 | Group columns | Type groups sit in `TwoColumn`, and accounts use `Collapsible` | High | S |
| F13-T04 | Detail screen | Hero value with a count-up, a position block, and the same flat rows. A price line is **Blocked** on QF-01 | High | M |
| F13-T05 | Add form layout | Two columns at 1024 px and above. Fields are paired (quantity with average price, current price with fees). The emoji grid moves into a popover on the icon tile. The Add button is sticky | Critical | M |
| F13-T06 | Summary rail | A sticky card echoing the entered name, symbol and icon in the list-row style. No computed totals (D-F17) | Medium | S |
| F13-T07 | Tests | Component tests for the paired fields. A Playwright create-investment flow at 1280 px and 360 px | High | M |

**Acceptance criteria**

- No investment screen has more than one card nesting level.
- The Add button is visible without scrolling at 1280 px.
- Chart colours come from tokens and stay legible in both themes.

---

## 5. Risks and open items

| ID | Type | Description | Mitigation |
| --- | --- | --- | --- |
| RF-07 | Risk | Count-up breaks the no-`Number()` money rule if implemented naively | F11-T04 interpolates with `decimal.js-light` and a unit test checks the exact final string |
| RF-08 | Risk | Animated numbers leak digits while amounts are hidden | F11-T08 checks the DOM at several frames |
| RF-09 | Risk | Account grouping and Set target exist in the UI but not in the plan | Confirm backend P18 status and add it to the plan before F13 |
| QF-01 | Open | Does the API expose price history for a single investment? Needed for the detail price line | Confirm before F13-T04 |
| QF-02 | Open | Desktop layout choice | See D-F14 |

## 6. Recommended 
1. Decide D-F14 and D-F17.
2. Provide a screenshot of the investment detail page.
3. Start F11-T01 and F11-T02. Widths and column stretching cause most of the visible problems.
4. Confirm whether "home asset" meant the Assets page only, or also the Home dashboard.