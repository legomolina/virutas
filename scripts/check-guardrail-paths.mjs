#!/usr/bin/env node
// Fails when a pull request that the owner did not open changes a guardrail:
// the workflows, the agent configuration and instructions, the checks and the
// lint, test and build configuration that keep agents (and humans) on track.
// The owner approves such a change by adding the `guardrails-approved` label.
//
// Reads the changed paths from stdin, one per line (renames list both the old
// and the new path). Takes the PR author's association from the
// AUTHOR_ASSOCIATION environment variable, and APPROVED=true when the label is
// on the PR. Runs in `.github/workflows/guardrails.yml`.

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
  'pnpm-workspace.yaml',
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

const isGuardrail = (path) =>
  GUARDRAIL_PATHS.some((guarded) =>
    guarded.endsWith('/') ? path.startsWith(guarded) : path === guarded,
  );

const changed = readFileSync(0, 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

const touched = [...new Set(changed.filter(isGuardrail))].sort();
const byOwner = process.env.AUTHOR_ASSOCIATION === 'OWNER';
const approved = process.env.APPROVED === 'true';

if (touched.length > 0 && !byOwner && !approved) {
  console.error(
    `check-guardrail-paths: this pull request changes guardrails, which only the owner may change:\n${touched
      .map((path) => `  ${path}`)
      .join('\n')}\nThe owner can approve it by adding the "guardrails-approved" label.`,
  );
  process.exit(1);
}

if (touched.length > 0) {
  console.log(
    `check-guardrail-paths: guardrail changes allowed (${byOwner ? 'opened by the owner' : 'approved by label'}).`,
  );
}
