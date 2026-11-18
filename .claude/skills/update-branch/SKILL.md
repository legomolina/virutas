---
name: update-branch
description: Bring a pushed PR branch up to date with main by merging origin/main into it. Use when a PR has conflicts, is behind main, or the user asks to update it.
argument-hint: '[pr-number]'
---

PR: `$ARGUMENTS`, or the PR of the current branch when empty.

A branch that is on GitHub is shared history: other sessions, review comments and CI runs point at its commits. It is updated by **merging** `origin/main` into it and pushing on top, so every push is a plain `git push`. PRs are squash-merged, so the merge commit never reaches `main`. (Rebasing is for a branch that has never been pushed; once it is on GitHub, merge.)

1. **Locate.** `gh pr view <pr> --json number,headRefName,mergeStateStatus,body`. Work in the worktree that has `headRefName` checked out (`git worktree list`); when this session is not in it, stop and name that folder. The working tree must be clean (`git status --short` empty), and the issue number is the `Closes #<n>` in the body, which gives the port, 4200 + n. Done when you are on the PR's branch with a clean tree.
2. **Merge.** `git fetch origin`, then `git merge --no-edit origin/main`. When it reports nothing to merge and the PR is not `DIRTY`, the branch is already up to date: report that and stop.
3. **Resolve.** For each conflicted file (`git diff --name-only --diff-filter=U`), read both sides (`git show :2:<file>` is this branch, `:3:<file>` is `main`) and write the file that keeps the intent of both: every test from each side, `main`'s formatting of keys this branch did not add, sections in the order the design shows. Then look past the markers: names, imports and helpers that `main` added can clash with this branch's code without a textual conflict. Done when `git diff --check` and `grep -rn '^<<<<<<<\|^>>>>>>>' <files>` find nothing, then `git add` the files and `git commit --no-edit`.
4. **Check.** `pnpm lint`, `pnpm typecheck` and `pnpm test:ci`; `pnpm mutation` when the merge touched a `*.calc.ts`; `E2E_PORT=<port> pnpm e2e` when it touched UI. Fix what the combination broke in a new commit (`fix:` or `test:`). Done when all of them pass.
5. **Push.** `git push`, as a command of its own.
6. **Confirm.** `gh pr view <pr> --json mergeable,mergeStateStatus` shows `MERGEABLE` and no longer `DIRTY` or `BEHIND`. Then `gh pr checks <pr> --watch`: a red job means reading `gh run view --log-failed` and going back to step 4.

Done when the PR is mergeable, every check is green, and you have told the user which files conflicted and how each was resolved.
