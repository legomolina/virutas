import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('pick-ready-issues.mjs', import.meta.url));

const OWNER = 'the-owner';

/** An issue an agent can start on, with any field overridden. */
const ready = (number, overrides = {}) => ({
  number,
  state: 'open',
  labels: ['ready-for-agent', 'model:sonnet'],
  blockedBy: 0,
  assigned: false,
  readyLabelledBy: OWNER,
  ...overrides,
});

/** Runs the picker on the given candidates; returns its exit status and the picked numbers. */
function pick(candidates, { owner = OWNER, input } = {}) {
  const result = spawnSync(process.execPath, [SCRIPT], {
    input: input ?? JSON.stringify(candidates),
    encoding: 'utf8',
    env: { PATH: process.env.PATH, OWNER: owner },
  });
  return {
    status: result.status,
    stderr: result.stderr,
    picked: result.stdout.split('\n').filter(Boolean).map(Number),
  };
}

describe('pick-ready-issues', () => {
  it('picks an open, unblocked issue the owner marked ready-for-agent', () => {
    assert.deepEqual(pick([ready(149)]).picked, [149]);
  });

  it('picks every candidate that can start, in ascending numeric order', () => {
    assert.deepEqual(pick([ready(100), ready(9), ready(10)]).picked, [9, 10, 100]);
  });

  it('picks nothing from no candidates', () => {
    const result = pick([]);

    assert.equal(result.status, 0);
    assert.deepEqual(result.picked, []);
  });

  it('skips a closed issue', () => {
    assert.deepEqual(pick([ready(149, { state: 'closed' })]).picked, []);
  });

  it('skips an issue without ready-for-agent', () => {
    assert.deepEqual(pick([ready(149, { labels: ['needs-triage'] })]).picked, []);
  });

  it('skips an issue an agent is already on', () => {
    assert.deepEqual(pick([ready(149, { labels: ['ready-for-agent', 'in-progress'] })]).picked, []);
  });

  it('skips an issue someone is assigned to, as when the owner works on it locally', () => {
    assert.deepEqual(pick([ready(149, { assigned: true })]).picked, []);
  });

  it('skips an issue that an open issue still blocks', () => {
    assert.deepEqual(pick([ready(152, { blockedBy: 1 })]).picked, []);
  });

  it('skips an issue whose ready-for-agent label someone other than the owner added', () => {
    assert.deepEqual(pick([ready(149, { readyLabelledBy: 'claude[bot]' })]).picked, []);
  });

  it('skips everything when the owner is unknown', () => {
    assert.deepEqual(pick([ready(149, { readyLabelledBy: '' })], { owner: '' }).picked, []);
    assert.deepEqual(pick([ready(149)], { owner: '' }).picked, []);
  });

  it('skips everything when OWNER is not set', () => {
    const result = spawnSync(process.execPath, [SCRIPT], {
      input: JSON.stringify([ready(149, { readyLabelledBy: '' })]),
      encoding: 'utf8',
      env: { PATH: process.env.PATH },
    });

    assert.equal(result.stdout, '');
  });

  it('picks the startable issues and skips the rest', () => {
    const result = pick([ready(150), ready(151, { blockedBy: 2 }), ready(152)]);

    assert.deepEqual(result.picked, [150, 152]);
  });

  it('fails on input that is not a JSON array', () => {
    for (const input of ['not json', '{"number": 149}']) {
      const result = pick(undefined, { input });

      assert.equal(result.status, 1, input);
      assert.match(result.stderr, /pick-ready-issues/);
    }
  });
});
