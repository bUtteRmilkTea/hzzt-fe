Work through plan/feedbacl-fe-3-plan.md in this order: F16, then F15, then F17.
(F16 first on request: the motion has been reported missing twice, so find out why before anything else.)

Base branch: the current frontend branch (feat/desktop-density-motion). Branch each phase from it.

Branch names carry NO phase number: F16 -> feat/motion-visible, F15 -> feat/layout-goals-transfer-grouping, F17 -> feat/nav-scroll-motion.

For each phase:
0. make a new branch with the format feat/[phase name], no number
1. Implement it fully.
2. Run the tests (and add tests for what you built). Make sure the app starts.
   Motion tasks must be checked in a real browser (Playwright), not only jsdom. Never tick a motion task from unit tests alone.
3. Only if everything passes: tick off the task in the plan and commit
   with a message like "[feat]: [branch name]". -m "[phase-t] [what you add]"

   if all sub phase alr done for a phase push it and make a pr to development branch
4. Then move on to the next phase.

Stop and ask me if:
- tests keep failing after a few honest attempts
- you need a secret, API key, or a decision only I can make
- a real browser cannot be launched (do not tick motion tasks without one)

API url prefix: localhost:8080/api/v1/ (already stored in .env as VITE_API_URL)

Never commit .env or secrets. Don't skip phases or rewrite the plan silently.
