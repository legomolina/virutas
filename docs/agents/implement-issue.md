# Implementing an issue

The steps for taking one issue to a PR. Two entry points follow them:

- **`@claude` on GitHub**: `.github/workflows/claude.yml` points here. Its runner has a headless browser for the `a11y-auditor` (start the dev server for it at `http://localhost:4200`), but none for you to look at. It starts on an `@claude` comment, or by itself when the issue becomes ready (`.github/workflows/claude-ready.yml`, see `docs/agents/triage-labels.md`); then nobody is watching, so its request says to report on the issue.
- **`/implement <n>` locally**: `.claude/skills/implement/`, in a worktree of its own (it creates one with the `/create-worktree` steps when run from the main checkout). It owns port 4200 + n.

Where the two differ, the step says so. Anything the request adds or changes wins over these steps.

1. Read the issue with its comments (`gh issue view <n> --comments`) and everything it points at: its parent issue, linked designs, the ADRs in `docs/adr/` and `GLOSSARY.md`. Stop and say why when an open issue still blocks it.
2. Build it with the `mattpocock-skills:tdd` skill. For a bug or flaky behaviour, use `mattpocock-skills:diagnosing-bugs` first, and find the cause before changing code. Run single spec files and `pnpm typecheck` while iterating.
3. Meet every line of the Definition of Done in `CLAUDE.md`. When `*.calc.ts` changes, that includes `pnpm mutation`. UI work:
   - **Locally**: check it against the design in the browser and run `E2E_PORT=<port> pnpm e2e`.
   - **On GitHub**: leave the e2e run to CI, which step 6 waits for. There is no browser to check the design by eye.
4. Review before finishing, and fix what the reviews find:
   - the `test-reviewer` subagent, when you added or changed tests;
   - the `a11y-auditor` subagent, when the UI changed, with the dev server URL (on GitHub, start it first with `pnpm start --port 4200` as a background command, wait until its output shows the build finished and the server listening on `http://localhost:4200`, and pass that URL);
   - the `mattpocock-skills:code-review` skill, always.
5. Commit with Conventional Commits. Run `git push` as a command of its own. Then open the PR with `gh pr create`, as its own command, with a title in Conventional Commits form and a body written with the `mattpocock-skills:pr` skill that starts with `Closes #<n>`. On GitHub, the automatic review (`claude-code-review.yml`) runs on it, and the owner reviews and merges it.
6. Watch CI with `gh pr checks <pr> --watch`. On GitHub, give it the Bash tool's longest timeout (10 minutes) and run it again when it times out before CI ends.
   - A red job: read `gh run view --log-failed`, fix the cause and push again.
   - The PR conflicts with `main` or is behind it: follow `/update-branch`.
   - A green e2e job can still hide retried failures. Search its log for `flaky`, and treat each one as a failure to fix. When it predates this branch, report it instead.
   - A red **Guardrail paths** check is not yours to fix: the PR changes a guardrail and waits for the owner's approval. Say so in the summary.
7. Finish with a summary:
   - what changed;
   - every acceptance criterion, ticked or explained;
   - the checks you ran and their results;
   - the PR link;
   - anything you decided that the issue left open.

Done when the work is pushed, the PR is open with every check green (apart from a Guardrail paths check waiting for the owner) and no flaky test introduced by this branch, and every criterion and check is accounted for.
