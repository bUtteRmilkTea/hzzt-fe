# Frontend Plan Addendum 4: Goals Button, Add Return, Full-Width Pages, Logout and Auth Split (F18 to F20)

Nov 22, 2026 · @jo

This addendum extends `docs/frontend-plan.md` and follows `plan/feedbacl-fe-3-plan.md` (F15 to F17). It does not replace either. Section numbers refer to that document. The backend plan is still authoritative for all API contracts.

| Field | Value |
| --- | --- |
| Document | Addendum 4 to the frontend plan: behaviour fixes, full-width pages and a split auth screen |
| Scope | Frontend only. No backend change is required |
| Sources | Written review feedback on the shipped F15 to F17 build (6 items, no recording) |
| Status | Planning. F18 is Ready now. D-F23 is Open |

**Verification limits.** The feedback is text only, so the root causes below are **inferred** from reading the code, not observed. Each fix starts with a repro at 1440 px and 360 px. Playwright specs run locally only (decision 6 of `feedback-fe-plan.md`), in a real browser, as F16 established. Never tick a motion or layout task from unit tests alone.

---

## 1. Feedback, mapped to causes

| # | Feedback | Page | Likely root cause (inferred) | Phase |
| --- | --- | --- | --- | --- |
| 1 | More than 3 goals: show a "View more" button under the list. 3 or fewer: no button. Remove the "View all" link | Home | `GoalsCard` (`features/dashboard/cards.tsx`) always renders a "View all" link in its header, and the list is capped at 3 with no way to tell that more exist | F18 |
| 2 | Add transaction, then Cancel: stay on the page the user came from (Home stays Home) | Whole app | The shell Add button (`routes/_authed.tsx`) navigates to `/transactions/new` with no `returnTo`. F15-T04 added `returnTo` for wallet detail only. `AddTransactionSheet.close()` falls back to History. The History "Add transaction" link has the same gap | F18 |
| 3 | Settings still has blank space left and right | Settings | `SettingsScreen` uses `<Page width="form">`, capped at `--page-max-form` (1120 px), and stacks every row in one column | F19 |
| 4 | Edit wallet and Wallet detail still have much blank space left and right | Edit wallet, Wallet detail | Both use `<Page width="form">`. F15-T03 made the card compact but left the page in the narrow tier, so the transactions list and the form stay in a 1120 px column | F19 |
| 5 | Logout button in Settings, not in Profile | Settings, Profile | `SignOut` is a private component at the bottom of `features/auth/ProfileScreen.tsx` | F18 |
| 6 | Login, Register and Forgot password: split into two halves, a simple animation on the left, the form on the right | Auth | `routes/_guest.tsx` is one centred `max-w-sm` column on a flat background. Reset password and the invitation screen use the same layout | F20 |

---

## 2. Impact on the existing plan

| Item | Impact |
| --- | --- |
| F15-T04 (`returnTo`) | Generalised. The shell Add button and every other "add" entry point pass the current location. `safeReturnTo` is extended to accept a query string, and still rejects any scheme, host or `//` (RF-12) |
| F15-T02 (Home goals) | The list cap stays at 3. The header link is removed and a button appears below the list only when there are more than 3 active goals (QF-04 still says active only) |
| F17 / D-F22 | The auth animation obeys the same rule as every other motion: instant under OS reduced motion, unless "Always play" is chosen in Settings |
| `Page` container | A third width tier is not needed. Settings, Edit wallet and Wallet detail move to the existing `wide` tier and fill it with columns, not with stretched rows |
| Performance budget (5.9) | The auth animation is CSS and inline SVG only, with no new library. The auth route chunk stays within the lazy-chunk budget |
| Settings sub-pages | Security, Space settings and Currency use the same `form` tier today. They are included in F19 so the whole Settings area does not mix two widths (D-F24) |
| F10 | Re-measure Lighthouse after F20 (the auth screens are the first thing a new user loads) |

### New decisions

| ID | Decision | Status | Recommended |
| --- | --- | --- | --- |
| D-F23 | Use an animation on the auth left panel | **Open** | Yes. A short, looping, CSS-only scene (a net-worth line that draws, a number that counts up, soft floating cards). It restates the product in the first screen, and costs about 2 KB. It stops under reduced motion and shows a still frame. The alternative is a static brand panel with no motion |
| D-F24 | Scope of the Settings width fix | Proposed | Settings, Security, Space settings and Currency share one `SettingsLayout`, so the area is consistent. Only Settings is named in the feedback, so confirm |
| D-F25 | Where an Add return path comes from | Proposed | The router's current location (`pathname` plus `search`), read at click time, passed as `returnTo`. A page may override it (wallet detail already does) |
| D-F26 | Goals "View more" target | Proposed | The Goals page (`/s/$spaceId/goals`). The button is full width under the list, a secondary style |
| D-F27 | Auth panel on small screens | Proposed | Below 1024 px the left panel is hidden and the form is a single centred column as today. The split shows from 1024 px |
| D-F28 | Logout confirmation | Proposed | No confirm dialog. The session ends at once, as Profile's Sign out does today. A confirm step is easy to add if you want one |

---

## 3. Phases

Run them in order. F19 and F20 are independent of each other once F18 is merged.

## Progress

Tick a task only after tests pass and the app starts. Added by the build loop; the tables below are unchanged.

**F18**
- [x] F18-T01 Goals View more (header link removed, button only above 3 active goals)
- [x] F18-T02 Add return path (`returnToFor` from the router location, query string allowed, `/s/` and `/settings` prefixes. A successful save uses the same `close()`; it is covered by the code path, the e2e covers Close and Escape)
- [x] F18-T03 Logout in Settings
- [x] F18-T04 Tests (unit, component, and `test/e2e/add-return.spec.ts` passing in real Chromium at 1440 and 360 px)

**F19**
- [x] F19-T01 Settings layout (wide tier, two columns: links on the left, preferences and Sign out on the right)
- [x] F19-T02 Edit wallet layout (form and balance adjustment left, sticky live card preview and display options right)
- [x] F19-T03 Wallet detail layout (wide tier, transactions 8 of 12 columns and a details column from 1280 px. The period income and expense block is NOT built: it needs a wallet-scoped server total, and summing in the client is forbidden by 5.2. The side column shows details, reserved and available instead)
- [x] F19-T04 Settings sub-pages (Profile, Space, Security and Currency use the shared `SettingsGrid`)
- [x] F19-T05 Tests (`test/e2e/width-fill.spec.ts` in real Chromium: it fails on the old layout at 1920 px for all 7 screens and passes now, plus 360 px overflow and the live preview)

**F20**
- [x] F20-T01 Auth shell (two equal halves from 1024 px in `routes/_guest.tsx`, panel hidden below)
- [x] F20-T02 Animated panel (`AuthPanel`: CSS and inline SVG, a 9 s loop: the line draws, the figure counts up, two cards drift. One still, finished frame under OS reduced motion)
- [x] F20-T03 Screens (Login, Register, Forgot password and Reset password inherit the shell. The invitation screen is under `_authed`, not the guest layout, so it is unchanged)
- [x] F20-T04 Tests (component tests, and `test/e2e/auth-split.spec.ts` in real Chromium: halves at 1440 px, no panel and no overflow at 390 px, the line draws and loops with motion on, is still under reduced motion, axe including colour contrast)

---

### F18: Behaviour fixes

**Goal:** Make the Home goals list honest about how many goals exist, make Add return to where it started, and move Sign out into Settings. **Depends on:** F15 · No backend · **Size:** Small-Medium

| ID | Task | Technical approach | Pri | Size |
| --- | --- | --- | --- | --- |
| F18-T01 | Goals View more | In `GoalsCard`, remove the header "View all" link. Show up to 3 active goals as now. When there are more than 3 active goals, render a full-width secondary "View more" button under the list that links to the Goals page (D-F26). With 3 or fewer, render nothing under the list. The empty state keeps its single "Add goal" action | Critical | S |
| F18-T02 | Add return path | A shared `useAddTransaction()` helper in `features/transactions` builds the link: it reads the router location when called and passes `returnTo` (pathname plus search). Use it in the shell Add button (`routes/_authed.tsx`) and the History empty-state link. Extend `safeReturnTo` to accept a query string (allow `?`, `&`, `=`, `%`, and `:` only inside the query) while still requiring a `/s/` path and rejecting `//`, `\`, any scheme and non-visible characters. Cancel, the Close button, Escape and a successful save all return to `returnTo`. A page that already passes its own `returnTo` (wallet detail) wins | Critical | M |
| F18-T03 | Logout in Settings | Move the Sign out button from `ProfileScreen` to `SettingsScreen`, in its own group at the bottom, above the version line. It keeps calling `logout()` from `useSession`. Remove it from Profile so there is exactly one. No confirm (D-F28) | High | S |
| F18-T04 | Tests | Component: goals card with 3 goals shows no button, with 4 shows "View more" and no "View all" anywhere. Unit: `safeReturnTo` accepts `/s/s-1?period=month&x=1`, still rejects `https://x`, `//x`, `/s/a//b`, `/s/a\b`. Component: Settings has one "Sign out", Profile has none. Playwright: from Home, from History and from a wallet, click Add, then Cancel, and the URL is unchanged (1440 px and 360 px) | Critical | M |

**Acceptance criteria**

- With 3 or fewer active goals Home shows no goals button and no "View all". With 4 or more it shows "View more" under the list.
- Add then Cancel leaves the user on the same page, with the same query string, from every page that has an Add entry point.
- A tampered `returnTo` falls back to History and never leaves the app.
- Sign out appears in Settings and nowhere else.

---

### F19: Full-width Settings, Edit wallet and Wallet detail

**Goal:** Use the whole content width on the three screens still showing blank space, by arranging content in columns. **Depends on:** F11, F15 · No backend · **Size:** Medium

| ID | Task | Technical approach | Pri | Size |
| --- | --- | --- | --- | --- |
| F19-T01 | Settings layout | `SettingsScreen` moves to `<Page width="wide">` with a two-column grid from 1024 px: the account and navigation groups (Profile, Space, Categories, Goals, Currency) on the left, the preferences groups (App lock, Hide amounts, Animations, Keyboard) and Sign out on the right. One column below 1024 px. Rows get the same card surface (`cardClass`) | Critical | M |
| F19-T02 | Edit wallet layout | `EditWalletScreen` moves to the wide tier. From 1024 px the form is on the left and a live card preview (`WalletCard size="compact"`, fed by the form state) is sticky on the right. The card editor link and the delete action sit under the preview. One column below 1024 px | Critical | M |
| F19-T03 | Wallet detail layout | `WalletDetailScreen` moves to the wide tier. Top row as in F15-T03 (compact card beside the balance and actions). Below it, two columns from 1280 px: the transactions list takes about 8 of 12 columns, and a side column (about 4) shows reserved for goals, available, and the wallet's income and expense for the period (server figures, no client totals, 5.2). Single column below | Critical | L |
| F19-T04 | Settings sub-pages | Security, Space settings and Currency use the same wide tier and a shared `SettingsLayout` (a back link, a title, a grid) so the whole area is consistent (D-F24). Forms stay readable: fields are paired in two columns at 1024 px and above, never stretched across 1500 px | High | M |
| F19-T05 | Tests | Playwright at 1440 px and 1920 px: no horizontal gap wider than 48 px beside the content on each screen, and the content box is at least 1000 px wide. At 360 px: no horizontal overflow. Component: the Edit wallet preview follows the typed name. Unit: nothing new | High | M |

**Acceptance criteria**

- At 1440 px, Settings, Edit wallet and Wallet detail fill the content area, with only the page gutter on each side.
- No form field or text row is stretched wider than about 640 px. The width is used by columns, not by long rows.
- At 360 px nothing overflows and nothing changes from today.

---

### F20: Split auth screens with an animated panel

**Goal:** Make Login, Register, Forgot password and Reset password attractive with a two-section layout. **Depends on:** F16 (motion rules and the Settings override) · No backend · **Size:** Medium

| ID | Task | Technical approach | Pri | Size |
| --- | --- | --- | --- | --- |
| F20-T01 | Auth shell | Rebuild `GuestLayout` (`routes/_guest.tsx`) as a two-column grid from 1024 px: the left half is the brand panel, the right half is the form, centred vertically in a `max-w-sm` column. Below 1024 px the panel is hidden and the layout is as today (D-F27). Both halves fill the viewport height (`min-h-dvh`). Applies to every `_guest` route | Critical | M |
| F20-T02 | Animated panel | A `AuthPanel` component, CSS and inline SVG only (D-F23): a dark brand surface with the HZZT mark, a one-line promise, and a short looping scene. A net-worth line draws left to right, a number counts up beside it with `<Amount animate>` rules (no `Number()`), and two or three soft cards drift. The loop restarts every 8 to 10 seconds. It is `aria-hidden` and carries no information. Under OS reduced motion it shows one still frame. "Always play" in Settings is respected (it uses the same `data-motion` rule) | High | M |
| F20-T03 | Screens | Login, Register, Forgot password and Reset password keep their forms and validation and only move into the new right half. Titles and links get consistent spacing. The invitation-accept screen, if it uses the guest layout, inherits the split | High | S |
| F20-T04 | Tests | Component: each auth screen still renders its form and submits. Playwright at 1440 px: the panel and the form sit side by side, the panel's left edge is 0 and its width is about half. At 390 px: the panel is absent and there is no horizontal overflow. In a real browser with motion on, the panel's line `stroke-dashoffset` changes over time. With OS reduced motion it does not. Axe check on all four screens | Critical | M |

**Acceptance criteria**

- From 1024 px, each auth screen shows two equal halves: an animated panel on the left and the form on the right.
- The form behaves exactly as before: same fields, same errors, same redirects.
- The animation never plays under OS reduced motion (unless "Always play" is chosen), and the form stays fully usable if it is removed.
- The auth route chunk stays within the lazy-chunk budget.

---

## 4. Risks and open items

| ID | Type | Description | Mitigation |
| --- | --- | --- | --- |
| RF-14 | Risk | `returnTo` now carries a query string, which widens the open-redirect surface from F15 (RF-12) | F18-T02 keeps the `/s/` prefix rule, rejects `//`, `\` and any scheme, and unit tests tampered values |
| RF-15 | Risk | A very wide screen stretches rows even inside the wide tier | F19 uses columns and caps readable rows at about 640 px, and F19-T05 checks 1920 px |
| RF-16 | Risk | The auth animation costs bundle size or hurts first paint on the first screen a new user sees | CSS and SVG only, lazy route chunk, and F10 Lighthouse re-run after F20 |
| RF-17 | Risk | Users who have reduced motion on (as seen during F16) will see a still panel and may think it is broken | A still frame is designed to look finished, and the Settings override from F16 applies here too |
| QF-05 | Open | D-F23: use an animation on the auth left panel? | Recommended yes, see D-F23. Reply with "static" to use a plain brand panel instead |
| QF-06 | Open | D-F24: should Security, Space settings and Currency also move to the wide tier? | Recommended yes, for consistency |
| QF-07 | Open | Should Sign out ask for confirmation? | Recommended no (D-F28) |

## 5. Recommended order

1. Decide D-F23 (animation or static) and D-F24.
2. Do F18 first. It is three small, high-visibility fixes, and F18-T02 touches every page that has an Add entry point.
3. Do F19 next, then F20. They are independent, so F20 can start as soon as D-F23 is answered.
4. After F20, re-run Lighthouse (F10), and run the full Playwright suite in a real browser.
