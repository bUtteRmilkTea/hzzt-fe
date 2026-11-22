Work through plan/plan.md from phase f0 to f10, starting from phase f0 all the way to f10.

For each phase:
0. make a new branch with the format [feat]/[phase name]
1. Implement it fully.
2. Run the tests (and add tests for what you built). Make sure the app starts.
3. Only if everything passes: tick off the phase in PLAN.md and commit
   with a message like "[feat]: [branch name]". -m "[phase-t] [what you add]"

   if all sub phase alr done for a phase push it  and make a pr to development branch
4. Then move on to the next phase.

Stop and ask me if:
- tests keep failing after a few honest attempts
- you need a secret, API key, or a decision only I can make

here's the url prefix for the api localhost:8080/api/v1/ 
please store it in env

Never commit .env or secrets. Don't skip phases or rewrite the plan silently.
