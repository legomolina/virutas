#!/usr/bin/env node
// Picks the issues an agent can start on now, out of the open
// `ready-for-agent` issues `.github/workflows/claude-ready.yml` gathers when
// an issue gets that label or when a closed issue may have unblocked others.
// An issue can start when it is open, has `ready-for-agent` (added by the
// owner, so nobody else can spend the owner's subscription), is not already
// `in-progress`, nobody is assigned to it (`/create-worktree` assigns the
// owner when they take it locally), and no open issue blocks it.
//
// Reads a JSON array of candidates from stdin:
//   { number, state, labels: string[], blockedBy, assigned, readyLabelledBy }
// where `blockedBy` counts the open issues blocking it and `readyLabelledBy`
// is the login that last added `ready-for-agent`. Takes the repository
// owner's login from OWNER. Prints the picked issue numbers, one per line,
// in ascending order.

import { readFileSync } from 'node:fs';

function fail(message) {
  console.error(`pick-ready-issues: ${message}`);
  process.exit(1);
}

let candidates;
try {
  candidates = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  fail('stdin is not valid JSON.');
}
if (!Array.isArray(candidates)) {
  fail('stdin is not a JSON array of candidates.');
}

const owner = process.env.OWNER ?? '';

const canStart = (issue) =>
  owner !== '' &&
  issue.state === 'open' &&
  issue.labels.includes('ready-for-agent') &&
  !issue.labels.includes('in-progress') &&
  issue.blockedBy === 0 &&
  issue.assigned === false &&
  issue.readyLabelledBy === owner;

const picked = candidates
  .filter(canStart)
  .map((issue) => issue.number)
  .sort((a, b) => a - b);

for (const number of picked) {
  console.log(number);
}
