---
name: implement
description: Take one GitHub issue to an open, green PR in its own worktree, creating the worktree first when run from the main checkout.
disable-model-invocation: true
argument-hint: <issue-number>
---

Issue: `$ARGUMENTS`. Without a number, ask for one.

The work happens in a linked worktree: `git rev-parse --git-dir` differs from `git rev-parse --git-common-dir`.

- **Already in one** (made earlier by `/create-worktree <n>`): carry on below.
- **In the main checkout**: follow steps 1–4 of `.claude/skills/create-worktree/SKILL.md` (check and claim the issue, choose the branch, run `setup-worktree.sh`), stopping wherever they say to stop. Then switch this session into the worktree path the script printed with the `EnterWorktree` tool (a deferred tool) and its `path` parameter. Confirm with `git rev-parse --show-toplevel` that the session is now there. When `EnterWorktree` is not available or fails, stop and tell the user to open a session in that path and run `/implement <n>`.

Other sessions run in parallel worktrees, so this one owns the port **4200 + issue number**. Use it everywhere:

- `pnpm start --port <port>`;
- `E2E_PORT=<port> pnpm e2e`;
- its URL for the Playwright MCP tools and the `a11y-auditor`.

Set the session title to `#<n> <issue title>` when the IDE offers a session-title tool (the JetBrains Air plugin's `air_set_session_title`, a deferred tool), so parallel sessions can be told apart. It errors outside an Air session; then carry on without a title.

Before starting, confirm the worktree is on the issue's branch, not `main`, and rebase it onto `origin/main` if it is behind.

Then follow `docs/agents/implement-issue.md`, taking its **Locally** branch at each step. Its completion criterion is this skill's.
