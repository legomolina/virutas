#!/usr/bin/env node
// Fails when a pull request that the owner did not open changes a guardrail:
// the workflows, the agent configuration and instructions, the checks and the
// lint, test, build and dependency configuration that keep agents (and humans)
// on track. The owner approves such a change by adding the
// `guardrails-approved` label; the label counts only when the owner added it.
//
// Reads the changed paths from stdin, one per line (the workflow lists both
// the old and the new path of a rename). Environment:
//   AUTHOR_ASSOCIATION  the PR author's association with the repo (`OWNER`…)
//   OWNER               the repository owner's login
//   APPROVED_BY         the login that added the `guardrails-approved` label
//                       now on the PR, or empty when it is not there
// Runs in `.github/workflows/guardrails.yml`.

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

const isGuardrail = (path) =>
  GUARDRAIL_PATHS.some((guarded) =>
    guarded.endsWith('/') ? path.startsWith(guarded) : path === guarded,
  );

const changed = readFileSync(0, 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

const touched = [...new Set(changed.filter(isGuardrail))].sort();
const owner = process.env.OWNER ?? '';
const byOwner = process.env.AUTHOR_ASSOCIATION === 'OWNER';
const approvedByOwner = owner !== '' && process.env.APPROVED_BY === owner;

if (touched.length > 0 && !byOwner && !approvedByOwner) {
  fail(
    `this pull request changes guardrails, which only the owner may change:\n${touched
      .map((path) => `  ${path}`)
      .join('\n')}\nThe owner can approve it by adding the "guardrails-approved" label.`,
  );
}
