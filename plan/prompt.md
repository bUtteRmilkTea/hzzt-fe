Work through plan/feedback-fe-8-plan.md in this order: F35, then F36, then F37, then F33, then F34, then F38, then F39.

Base branch: development (the current branch). Branch each phase from development. Only if a phase needs an earlier phase that is not merged yet, branch it from that phase's branch and say so in the PR.

Branch names carry NO phase number: F35 -> feat/assets-wallet-edit, F36 -> feat/home-goals-quick-actions, F37 -> feat/ux-polish-a11y, F33 -> feat/data-correctness-ui, F34 -> feat/investment-price-forms, F38 -> feat/language-icons-settings, F39 -> feat/growth-chart (needs BE Phase K, read section 7 of the plan).

Decisions already made: none yet. D-F44 to D-F51 are "Proposed, recommended" in the plan: implement the recommended option.
Backend dependency (the backend plan is ../hzzt/plan/feedback-be-2-plan.md): tasks marked "blocked on BE Phase X" may only be built once the field or endpoint exists in api/openapi.yaml (regenerate from ../hzzt/docs/swagger.yaml). If it does not exist yet, build only the frontend-only part the plan allows, leave the blocked task UNTICKED, and list it in your report. Never invent an endpoint or compute a server figure on the client.
READ SECTIONS 6 AND 7 OF THE PLAN FIRST. Q13 is answered: the Home quick-action carousel is NOT wanted (F36-T03 is dropped, do not build it), and F33-T01 is verify-then-skip if not reproducible.
READ SECTION 6 OF THE PLAN FIRST (corrections from a dry run, it overrides earlier sections). Several things the review describes were NOT found in the code: no Home quick-action carousel (F36-T03), no "No category" text (F33-T01), and the wallet editor is a page plus an options sheet, not two edit sheets (F35-T02). For those, reproduce the screen in the browser, show me what you find, and STOP and ask (Q13) instead of inventing a component. `net` and `categoryIds` already exist in the API.
Open question Q10 (which goals screen is "too big"): the plan covers both screens, so implement both and note it in the PR.

For each phase:
0. make a new branch with the format feat/[phase name], no number
1. Implement it fully.
2. Run the tests (and add tests for what you built): pnpm lint, typecheck, vitest, pnpm size. Make sure the app starts.
   Layout, motion, contrast, touch-target and chart-interaction tasks must be checked in a real browser (Playwright, 1440 px and 390 px, touch where the task says so), and axe for F37. Never tick them from unit tests alone.
3. Only if everything passes: tick off the task in the plan and commit
   with a message like "[feat]: [branch name]". -m "[phase-t] [what you add]"

   if all sub phase alr done for a phase push it and make a pr to development branch
4. Then move on to the next phase.

Commit the plan file edits (ticks, notes) with the phase they belong to. Tick per task; push and open the PR when every task of the phase is ticked or listed as blocked/skipped (say which in the PR body). Also run the full Playwright suite once after F35 (plan section 5 step 4). If you cannot find a cited file or symbol, say so, do not invent it.

Stop and ask me if:
- tests keep failing after a few honest attempts
- you need a secret, API key, or a decision only I can make
- a real browser cannot be launched (do not tick layout, motion or contrast tasks without one)
- a root cause in the plan ("inferred") turns out to be wrong

API url prefix: localhost:8080/api/v1/ (already stored in .env as VITE_API_URL). No API key belongs in the frontend.

Never commit .env or secrets. Don't skip phases or rewrite the plan silently (if the plan must change, add a dated note in the plan and tell me).
