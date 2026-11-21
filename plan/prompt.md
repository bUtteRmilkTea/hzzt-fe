Work through plan/feedbacl-fe-4-plan.md in this order: F18, then F19, then F20.

Base branch: the current frontend branch (feat/nav-scroll-motion). Branch each phase from the previous one (the earlier PRs are not merged yet).

Branch names carry NO phase number: F18 -> feat/goals-add-return-logout, F19 -> feat/full-width-pages, F20 -> feat/auth-split.

Decisions already made: use the auth animation (D-F23), move the whole Settings area to the wide tier (D-F24), no logout confirmation (D-F28).

For each phase:
0. make a new branch with the format feat/[phase name], no number
1. Implement it fully.
2. Run the tests (and add tests for what you built). Make sure the app starts.
   Layout and motion tasks must be checked in a real browser (Playwright), not only jsdom. Never tick them from unit tests alone.
3. Only if everything passes: tick off the task in the plan and commit
   with a message like "[feat]: [branch name]". -m "[phase-t] [what you add]"

   if all sub phase alr done for a phase push it and make a pr to development branch
4. Then move on to the next phase.

Stop and ask me if:
- tests keep failing after a few honest attempts
- you need a secret, API key, or a decision only I can make
- a real browser cannot be launched (do not tick layout or motion tasks without one)

API url prefix: localhost:8080/api/v1/ (already stored in .env as VITE_API_URL)

Never commit .env or secrets. Don't skip phases or rewrite the plan silently.
