---
name: implement
description: Take one GitHub issue to an open, green PR in its own worktree, creating the worktree first when run from the main checkout.
disable-model-invocation: true
argument-hint: <issue-number>
---

Issue: `$ARGUMENTS`. Without a number, ask for one.

The work happens in the issue's linked worktree, `<main checkout>-<n>`. A session is in a linked worktree when `git rev-parse --git-dir` differs from `git rev-parse --git-common-dir`.

- **In the main checkout**: set up the worktree with steps 1–4 of `.claude/skills/create-worktree/SKILL.md`, with two changes: skip its `Setup #<n>` title (this skill sets its own below) and skip its step 5. Every stop in steps 1–4 is a stop here too. Then load the deferred `EnterWorktree` tool (ToolSearch `select:EnterWorktree`) and call it with `path` set to the `worktree=` line the script printed. Check that `git rev-parse --show-toplevel` now prints that same path. When the tool is unavailable or the check fails, stop and give the user what step 5 of `/create-worktree` gives: the folder, `/implement <n>` and the model advice.
- **In a linked worktree**: its folder must end in `-<n>`. Otherwise stop: it belongs to another issue.

Other sessions run in parallel worktrees, so this one owns the port **4200 + issue number**. Use it everywhere:

- `pnpm start --port <port>`;
- `E2E_PORT=<port> pnpm e2e`;
- its URL for the Playwright MCP tools and the `a11y-auditor`.

Set the session title to `#<n> <issue title>` when the IDE offers a session-title tool (the JetBrains Air plugin's `air_set_session_title`, a deferred tool), so parallel sessions can be told apart. It errors outside an Air session; then carry on without a title.

Check the model: read the issue's labels (`gh issue view <n> --json labels`). When it has `model:sonnet` or `model:opus` and this session runs a different model, say so at the start and suggest switching with `/model`, then carry on. Without a model label, apply the table in `docs/agents/triage-labels.md` to the issue, say which model it points to, and ask the user to add the label.

Before starting, confirm the worktree is on the issue's branch, not `main`. When it is behind `origin/main`: rebase it while it has never been pushed (`git ls-remote --exit-code --heads origin <branch>` fails), otherwise follow `/update-branch`.

Then follow `docs/agents/implement-issue.md`, taking its **Locally** branch at each step. Its completion criterion is this skill's.
