#!/usr/bin/env node
// Fails when a pull request changes a guardrail (the workflows, the agent
// configuration and instructions, the checks and the lint, test, build and
// dependency configuration that keep agents and humans on track) unless the
// owner stands behind every commit in it:
//
// - the owner opened it and nobody else pushed to its branch, or
// - the owner added the `guardrails-approved` label after the last push by
//   anyone else.
//
// Pushes, not commit authors, because anyone can write any author into a
// commit; the @claude agent, for one, pushes a branch that the owner then
// opens a PR from. Pushes come from the repository activity API, so for a
// branch in a fork they are unknown, and only the owner pushing the change to
// a branch of this repository can make it pass.
//
// Reads the changed paths from stdin, one per line (the workflow lists both
// the old and the new path of a rename). Environment, all set by
// `.github/workflows/guardrails.yml`:
//   AUTHOR_ASSOCIATION  the PR author's association with the repo (`OWNER`…)
//   OWNER               the repository owner's login
//   HEAD_SHA            the PR's head commit
//   ACTIVITY            the branch's activity, newest first, as a JSON array
//                       of { type, after, actor, timestamp }; empty when
//                       unknown
//   APPROVAL            the latest time the label now on the PR was added, as
//                       JSON { actor, timestamp }; empty when it is not there

import { readFileSync } from 'node:fs';

/** Folders (ending in `/`) and files that only the owner may change. */
const GUARDRAIL_PATHS = [
  '.github/',
  '.claude/',
  '.githooks/',
  'docs/agents/',
  'scripts/',
  'stylelint/',
  'CLAUDE.md',
  '.mcp.json',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  '.npmrc',
  '.nvmrc',
  'angular.json',
  'eslint.config.mjs',
  'stylelint.config.mjs',
  '.prettierrc',
  '.prettierignore',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.spec.json',
  'tsconfig.worker.json',
  'playwright.config.ts',
  'stryker.config.mjs',
  'vitest.calc.config.mts',
];

function fail(message) {
  console.error(`check-guardrail-paths: ${message}`);
  process.exit(1);
}

/** Parses a JSON environment variable, or returns `fallback` when it is empty. */
function jsonEnv(name, fallback) {
  const value = process.env[name]?.trim();
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fail(`${name} is not valid JSON.`);
  }
}

/**
 * The pushes to the branch since it was last created (that creation
 * included), newest first, or `undefined` when they are unknown: no activity,
 * or the newest push is not the PR's head commit yet.
 */
function pushesSinceCreation(activity, headSha) {
  const pushes = [];
  for (const entry of activity) {
    if (entry.type !== 'branch_deletion') {
      pushes.push(entry);
    }
    if (entry.type === 'branch_creation') {
      break;
    }
  }
  return pushes.length > 0 && headSha && pushes[0].after === headSha ? pushes : undefined;
}

const isGuardrail = (path) =>
  GUARDRAIL_PATHS.some((guarded) =>
    guarded.endsWith('/') ? path.startsWith(guarded) : path === guarded,
  );

const touched = [
  ...new Set(
    readFileSync(0, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(isGuardrail),
  ),
].sort();

if (touched.length > 0) {
  const owner = process.env.OWNER ?? '';
  const pushes = pushesSinceCreation(jsonEnv('ACTIVITY', []), process.env.HEAD_SHA);
  const approval = jsonEnv('APPROVAL', undefined);

  const othersPushes = (pushes ?? []).filter((push) => push.actor !== owner);
  const lastOtherPush = Math.max(0, ...othersPushes.map((push) => Date.parse(push.timestamp)));
  const ownerOnly =
    owner !== '' &&
    process.env.AUTHOR_ASSOCIATION === 'OWNER' &&
    pushes !== undefined &&
    othersPushes.length === 0;
  const approvedByOwner =
    owner !== '' &&
    pushes !== undefined &&
    approval?.actor === owner &&
    Date.parse(approval.timestamp) > lastOtherPush;

  if (!ownerOnly && !approvedByOwner) {
    const others = [...new Set(othersPushes.map((push) => push.actor))];
    const why =
      pushes === undefined
        ? 'Who pushed to its branch is unknown (a branch in a fork, or the activity API has not caught up), so a label cannot approve it: the owner can push the change to a branch of this repository.'
        : `${others.length > 0 ? `Others pushed to its branch: ${others.join(', ')}. ` : ''}The owner can approve it by adding the "guardrails-approved" label after the last of those pushes.`;
    fail(
      `this pull request changes guardrails, which only the owner may change:\n${touched
        .map((path) => `  ${path}`)
        .join('\n')}\n${why}`,
    );
  }
}
