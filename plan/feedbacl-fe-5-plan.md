# Frontend Plan Addendum 5: Card Style Full Width, Unified Auth Screens, Modern Type (F21 to F23)

Nov 22, 2026 · @jo

This addendum extends `docs/frontend-plan.md` and follows `plan/feedbacl-fe-4-plan.md` (F18 to F20). It does not replace either. The backend plan is still authoritative for all API contracts.

| Field | Value |
| --- | --- |
| Document | Addendum 5 to the frontend plan: card style layout, auth screen rework, typography |
| Scope | Frontend only. No backend change is required |
| Sources | Written review feedback on the shipped F18 to F20 build (3 items) |
| Status | Planning. F21 is Ready now. D-F29 and D-F30 are Open |

**Verification limits.** The feedback is text only, so the root causes below are **inferred** from reading the code. Every layout or motion task is checked in real Chromium (Playwright) at 1440 px and 390 px. Never tick them from unit tests alone.

---

## 1. Feedback, mapped to causes

| # | Feedback | Page | Likely root cause (inferred) | Phase |
| --- | --- | --- | --- | --- |
| 1 | Card style has blank space left and right. Use all the space, like Edit wallet | Card style | `CardEditorScreen` uses `<Page width="form">` (1120 px) and one stacked column: preview, type switch, controls, buttons. Edit wallet uses `width="wide"` with a two-column grid (`EditLayout`) and a sticky preview | F21 |
| 2 | Login, Register, Forgot password: no line between the halves, one uniform background, the halves close together, and a simple animated background | Auth | `AuthPanel` has `border-r border-border` and `bg-surface-1`, while the form half is `bg-bg`, so two tones meet at a line. `GuestLayout` is `grid-cols-2`, so the form is centred in its own half, far from the panel content. The animation lives inside the panel card only | F22 |
| 3 | Font more modern and minimalist, like `hzzt-fe/plan` | Whole app | `--font-sans` lists `-apple-system`, `SF Pro Text`, `Segoe UI`, `Roboto` before Inter, so the face differs per OS and Inter is only the last fallback. Headings and labels lean on `font-semibold` (90 uses) with default tracking | F23 |

---

## 2. Impact on the existing plan

| Item | Impact |
| --- | --- |
| F20 (auth split) | Supersedes F20-T01 and the border and surface rules of F20-T02. The brand content and the form stay side by side from 1024 px, but on one surface with no divider. D-F27 (single column below 1024 px) still holds |
| F20 animation | The 9 s net-worth loop is kept. A new full-page background layer is added behind it (D-F29) |
| F19 / D-F24 | Card style joins Edit wallet and Wallet detail in the `wide` tier. No third tier is added to `Page` |
| `plan.md` C3 and Appendix B | C3 says "system typography". F23 narrows that: one self-hosted face everywhere, so it looks the same on every OS. Update C3 and the `--font-sans` line in Appendix B when F23 is done |
| Performance budget (5.9) | The background is CSS only (no canvas, no library). The font is already self-hosted, so no new request |
| `a11y.test.tsx`, `auth.test.tsx`, `auth-split.spec.ts` | Assertions on the panel border, panel width and `auth-panel` test id are updated, not deleted |

### New decisions

| ID | Decision | Status | Recommended |
| --- | --- | --- | --- |
| D-F29 | Which simple animation for the auth background | Done | All three looks are built and chosen by one variable, `VITE_AUTH_BG` in `.env` (`blobs`, `grid` or `sweep`; default `blobs`; a typo falls back to `blobs`). Restart the dev server or rebuild after changing it |
| D-F30 | Which typeface | Done | Inter variable, already self-hosted, now the primary face. Lighter weights (`font-medium` titles, semibold set to 560) and tight heading tracking. The `cv11` single-storey `a` was dropped: the bundled file does not contain it. Getting it needs the full Inter file (or Geist), which is a new asset, so it is left for you to decide |
| D-F31 | Auth layout grouping | Proposed | One centred group, `max-w-5xl`, two columns with a `gap-12 lg:gap-16`. Left: HZZT mark, card scene and tagline. Right: the form in a `max-w-sm` column. Below 1024 px the scene is hidden as today |
| D-F32 | Card style layout from 1024 px | Done | Left column: type switch, the controls for the chosen mode, then Cancel and Apply (a sticky bottom bar, so Apply is always reachable). Right column (about 26rem, sticky): the live card preview. Apply moved left of the original idea so the DOM and tab order stay preview, controls, buttons. Below 1024 px: one column as before |

---

## 3. Phases

Run them in order. They are independent of each other, so any order works once D-F29 and D-F30 are answered.

## Progress

**F21**
- [x] F21-T01 Card style layout (`width="wide"`, two-column grid, sticky compact preview from 1024 px; Apply bar stays sticky)
- [x] F21-T02 Wider controls (templates 3/4/5 columns, direction grid capped)
- [x] F21-T03 Tests (`test/e2e/card-style-layout.spec.ts` in real Chromium at 1440 px and 390 px)

**F22**
- [x] F22-T01 Uniform surface, no divider (panel border and surface removed, page is `bg-bg`)
- [x] F22-T02 Tighter grouping (one centred `max-w-5xl` group, gap 48 to 64 px)
- [x] F22-T03 Animated background (`AuthBackground`, three looks chosen by `VITE_AUTH_BG`: `blobs` default, `grid`, `sweep`)
- [x] F22-T04 Tests (unit for the resolver and each look; `auth-split` and new `auth-background` specs in real Chromium; each look also checked in the browser in light and dark)

**F23**
- [x] F23-T01 Font tokens (Inter leads `--font-sans`, antialiased smoothing. `cv11` was tried and dropped: the bundled latin file has no such feature, so it changed nothing)
- [x] F23-T02 Weight and tracking pass (every title-size `font-semibold` is now `font-medium`; `h1` to `h3` get `-0.02em`; `--font-weight-semibold` is 560 so the rest is a firm medium)
- [x] F23-T03 Money and numerals check (digits stay tabular, amounts unchanged, no overflow at 390 px on Home, Wallets, Wallet detail and Settings)
- [x] F23-T04 Tests and plan update (`test/e2e/typography.spec.ts` in real Chromium; `plan.md` C3, Fonts row and Appendix B updated. Lighthouse re-run is still to do, see section 5. Also hardened `density.spec.ts` to measure the resting layout, because the staggered entry animation made its 1 px check flaky)

### F21: Card style fills the page

| ID | Task | Detail | Priority | Size |
| --- | --- | --- | --- | --- |
| F21-T01 | Card style layout | In `CardEditorScreen.tsx` change `<Page width="form" gap={5}>` to `width="wide" gap={8}`. In `Editor`, copy the `EditLayout` grid from `EditWalletScreen.tsx` (`grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-10`). Left: the `SegmentedControl` and the mode controls. Right, `lg:sticky lg:top-4`: the `WalletCard` preview (use `size="compact"` as Edit wallet does) and the Cancel and Apply row. Keep the `data-testid` pattern (`card-editor-layout`, `card-preview`) | Critical | M |
| F21-T02 | Wider controls | The controls no longer sit in a 1120 px column, so scale them: the Template grid goes `grid-cols-3` to `grid-cols-3 sm:grid-cols-4 xl:grid-cols-5`, the Direction grid stays 4 columns but caps its width, Presets wrap as now. Check `ColorPicker` fills its column. Below 1024 px keep the single column and the sticky bottom action bar (`sticky bottom-24`); from 1024 px the bar is static inside the right column | High | S |
| F21-T03 | Tests | Component: `wallets.test.tsx` still finds Apply, Cancel and the preview, and the draft is still not saved until Apply. Playwright at 1440 px: the page content box is wider than 1120 px, preview and controls sit side by side, the preview stays in view after scrolling. At 390 px: single column, no horizontal overflow, Apply reachable above the tab bar | Critical | M |

### F22: Uniform auth screens with an animated background

| ID | Task | Detail | Priority | Size |
| --- | --- | --- | --- | --- |
| F22-T01 | Uniform surface, no divider | In `AuthPanel.tsx` remove `border-r border-border` and `bg-surface-1`. The whole `_guest` layout uses one background (`bg-bg`). The scene card keeps its own `border` and `bg-surface-2`, since it is a card, not a divider. Check light and dark | Critical | S |
| F22-T02 | Tighter grouping | In `routes/_guest.tsx` replace `lg:grid-cols-2` with one centred container (D-F31): `mx-auto grid min-h-dvh max-w-5xl items-center gap-12 px-6 lg:grid-cols-[1fr_minmax(0,24rem)] lg:gap-16`. The panel loses `min-h-dvh` and `p-10 xl:p-14`, so it sizes to its content and the two halves read as one group. Below 1024 px: form only, `HZZT` mark above it, as today | Critical | M |
| F22-T03 | Animated background | New `AuthBackground` (aria-hidden, `fixed inset-0 -z-10 overflow-hidden`), rendered once in `GuestLayout` so Login, Register, Forgot and Reset all get it. Per D-F29: 2 to 3 blurred blobs (`blur-3xl`, low opacity, theme tokens only) animated with `transform: translate3d` keyframes in `globals.css`, 20 to 30 s, alternate, different delays. Shown on all screen sizes. Under OS reduced motion it is one still frame (same `data-motion` rule as F17 and F20, "Always play" respected). The existing net-worth loop keeps playing on top | High | M |
| F22-T04 | Tests | Component: each auth screen still renders and submits. Playwright at 1440 px: no element between the halves has a border, panel and form share the same computed background, the gap between the scene and the form is at most about 96 px, the blobs' `transform` changes over time. With reduced motion it does not. At 390 px: no scene, no overflow. Axe including colour contrast over the animated background in both themes | Critical | M |

### F23: Modern, minimal type

| ID | Task | Detail | Priority | Size |
| --- | --- | --- | --- | --- |
| F23-T01 | Font tokens | In `tokens.css` set `--font-sans: "Inter var", system-ui, -apple-system, "Segoe UI", sans-serif` so Inter leads on every OS (D-F30). In `globals.css` add `font-feature-settings: "cv11", "ss01"` and `-webkit-font-smoothing: antialiased` on `html`, and `text-rendering: optimizeLegibility`. Keep `font-display: swap` and the existing preload in `index.html` | Critical | S |
| F23-T02 | Weight and tracking pass | Make restraint the default: page titles and card titles `font-medium` with `tracking-tight` (`-0.02em`), body `font-normal`, labels `font-medium text-label-secondary`. Reduce `font-semibold` to buttons, amounts and the few places where it carries meaning. Touch the shared components first (`PageHeader`, `Button`, `SegmentedControl`, `Field`, `Card`, `StatCard`, `AuthCard`), then grep the 90 remaining `font-bold` and `font-semibold` uses and keep only deliberate ones. Do not change sizes in the type scale | High | M |
| F23-T03 | Money and numerals check | `.tabular` and `<Amount>` keep `tabular-nums`. Confirm Inter's `cv11`/`ss01` do not change digit shapes or widths in amounts and charts. Re-run the count-up and layout-shift tests, because a different face can change widths and move the sliding nav indicator (RF-11: it re-measures after `document.fonts.ready`) | High | S |
| F23-T04 | Tests and plan update | Playwright: `document.fonts.check('16px "Inter var"')` is true and the computed `font-family` of `body` starts with `Inter var`. Visual spot checks at 1440 px and 390 px of Home, Wallets, Settings and Auth in both themes. Update `plan.md` C3 and Appendix B. Re-run Lighthouse (no CLS regression from the font swap) | Critical | M |

---

## 4. Risks

| ID | Type | Risk | Mitigation |
| --- | --- | --- | --- |
| RF-17 | Risk | Blurred blobs hurt contrast, so text on the auth form fails 4.5:1 | Keep blob opacity low, keep the form on a solid `bg-bg` field with no blob under inputs, and run axe in both themes (F22-T04) |
| RF-18 | Risk | Large blurred layers are costly on low-end phones | Only `transform` is animated, `will-change: transform`, 3 blobs at most, and the layer is a still frame under reduced motion |
| RF-19 | Risk | Removing the divider and the second surface makes the form and the scene blur together | The scene card keeps its own border and surface, and the form stays a plain column. Check visually before ticking F22-T01 |
| RF-20 | Risk | A sticky preview column on Card style is taller than a short laptop viewport | The preview is compact, the right column does not exceed `100dvh - 2rem`, and Apply stays reachable. Check at 1440 x 720 |
| RF-21 | Risk | A global font change shifts widths and breaks truncation, the nav indicator or the F11 count-up layout tests | F23-T03 re-runs them, and the nav indicator already re-measures after `document.fonts.ready` |
| RF-22 | Risk | "Like in `hzzt-fe/plan`" is read wrong, since `plan/` names no typeface | D-F30 is Open. Confirm the face before F23 starts, or point me at the exact reference |

---

## 5. Next steps

1. Answer D-F29 (animation style) and D-F30 (typeface). Both are needed for F22 and F23.
2. Do F21 first, since it is Ready now and needs no decision.
3. Do F22, then F23. F23 last, because a font change moves widths and the visual checks of F21 and F22 should be redone once after it.
4. After F23, re-run Lighthouse (F10) and the full Playwright suite in a real browser.
