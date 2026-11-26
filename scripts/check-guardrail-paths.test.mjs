import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('check-guardrail-paths.mjs', import.meta.url));

const OWNER = 'the-owner';
const HEAD = 'c3';

/** One entry of a branch's activity, as the workflow passes it. */
const entry = (type, after, actor, timestamp) => ({ type, after, actor, timestamp });

/** A branch the owner created and pushed to, newest first, ending at HEAD. */
const OWNER_ONLY = [
  entry('push', HEAD, OWNER, '2026-11-26T12:00:00Z'),
  entry('push', 'c2', OWNER, '2026-11-26T11:00:00Z'),
  entry('branch_creation', 'c1', OWNER, '2026-11-26T10:00:00Z'),
];

/** A branch the agent created and pushed to, newest first, ending at HEAD. */
const AGENT_PUSHED = [
  entry('push', HEAD, 'claude[bot]', '2026-11-26T12:00:00Z'),
  entry('branch_creation', 'c1', 'claude[bot]', '2026-11-26T10:00:00Z'),
];

/**
 * Runs the check on the given changed paths. By default: a PR by someone
 * else, in a repo owned by OWNER, whose head is HEAD, on a branch only the
 * owner pushed to (`activity: null` for unknown), with no approval label.
 */
function check(
  paths,
  { author = 'NONE', owner = OWNER, head = HEAD, activity = OWNER_ONLY, approval, env } = {},
) {
  return spawnSync(process.execPath, [SCRIPT], {
    input: paths.join('\n'),
    encoding: 'utf8',
    env: env ?? {
      PATH: process.env.PATH,
      AUTHOR_ASSOCIATION: author,
      OWNER: owner,
      HEAD_SHA: head,
      ACTIVITY: activity === null ? '' : JSON.stringify(activity),
      APPROVAL: approval === undefined ? '' : JSON.stringify(approval),
    },
  });
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('check-guardrail-paths', () => {
  describe('which paths are guardrails', () => {
    it('passes a PR by someone else that changes no guardrail', () => {
      const result = check([
        'src/app/tools/cut-optimizer/cut-optimizer.calc.ts',
        'public/i18n/es.json',
      ]);

      assert.equal(result.status, 0, result.stderr);
    });

    it('passes a PR with no changed paths', () => {
      assert.equal(check([]).status, 0);
    });

    for (const path of [
      '.github/workflows/ci.yml',
      '.github/workflows/new.yml',
      '.claude/settings.json',
      '.claude/hooks/stop.sh',
      '.githooks/pre-commit',
      'docs/agents/implement-issue.md',
      'scripts/check-translations.mjs',
      'stylelint/no-external-import.mjs',
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
    ]) {
      it(`fails a PR by someone else that changes ${path}, and names it`, () => {
        const result = check(['src/main.ts', path]);

        assert.equal(result.status, 1);
        assert.match(result.stderr, new RegExp(`^  ${escapeRegExp(path)}$`, 'm'));
      });
    }

    it('lists every guardrail touched, once each, sorted, and nothing else', () => {
      const result = check(['scripts/a.mjs', 'CLAUDE.md', 'scripts/a.mjs', 'src/main.ts']);

      assert.equal(result.status, 1);
      assert.match(result.stderr, /^ {2}CLAUDE\.md\n {2}scripts\/a\.mjs\n/m);
      assert.doesNotMatch(result.stderr, /src\/main\.ts/);
    });

    it('reads paths padded with spaces or ending in CRLF', () => {
      const result = check(['  src/main.ts\r', ' CLAUDE.md \r']);

      assert.equal(result.status, 1);
    });

    it('does not treat a path that only starts like a guardrail as one', () => {
      const result = check([
        'CLAUDE.md.bak',
        'docs/agents-notes.md',
        'scriptsx/a.mjs',
        '.github-foo/x.yml',
        'src/scripts/x.ts',
        'e2e/package.json',
      ]);

      assert.equal(result.status, 0, result.stderr);
    });
  });

  describe('who opened the PR and who pushed to it', () => {
    it('passes guardrail changes in an owner PR that only the owner pushed to', () => {
      const result = check(['.github/workflows/ci.yml', 'CLAUDE.md'], { author: 'OWNER' });

      assert.equal(result.status, 0, result.stderr);
    });

    it('treats a collaborator, a member or a lower-case "owner" like anyone else', () => {
      for (const author of ['COLLABORATOR', 'MEMBER', 'owner']) {
        assert.equal(check(['CLAUDE.md'], { author }).status, 1, author);
      }
    });

    it('fails guardrail changes in an owner PR that someone else pushed to, naming them once', () => {
      const result = check(['CLAUDE.md'], {
        author: 'OWNER',
        activity: [
          entry('push', HEAD, OWNER, '2026-11-26T13:00:00Z'),
          entry('push', 'c2', 'claude[bot]', '2026-11-26T12:00:00Z'),
          entry('push', 'c1', 'claude[bot]', '2026-11-26T11:00:00Z'),
          entry('branch_creation', 'c0', OWNER, '2026-11-26T10:00:00Z'),
        ],
      });

      assert.equal(result.status, 1);
      assert.match(result.stderr, /Others pushed to its branch: claude\[bot\]\./);
    });

    it('counts a force push by someone else', () => {
      const result = check(['CLAUDE.md'], {
        author: 'OWNER',
        activity: [
          entry('push', HEAD, OWNER, '2026-11-26T13:00:00Z'),
          entry('force_push', 'c2', 'claude[bot]', '2026-11-26T12:00:00Z'),
          entry('branch_creation', 'c1', OWNER, '2026-11-26T10:00:00Z'),
        ],
      });

      assert.equal(result.status, 1);
    });

    it('counts who created the branch', () => {
      const result = check(['CLAUDE.md'], {
        author: 'OWNER',
        activity: [
          entry('push', HEAD, OWNER, '2026-11-26T12:00:00Z'),
          entry('branch_creation', 'c1', 'claude[bot]', '2026-11-26T10:00:00Z'),
        ],
      });

      assert.equal(result.status, 1);
    });

    it('ignores pushes to an earlier branch of the same name', () => {
      const result = check(['CLAUDE.md'], {
        author: 'OWNER',
        activity: [
          entry('push', HEAD, OWNER, '2026-11-26T12:00:00Z'),
          entry('branch_creation', 'c1', OWNER, '2026-11-26T10:00:00Z'),
          entry('branch_deletion', '0000', OWNER, '2026-11-20T10:00:00Z'),
          entry('push', 'b2', 'claude[bot]', '2026-11-19T10:00:00Z'),
          entry('branch_creation', 'b1', 'claude[bot]', '2026-11-18T10:00:00Z'),
        ],
      });

      assert.equal(result.status, 0, result.stderr);
    });

    it('passes an owner PR that someone else pushed to when it changes no guardrail', () => {
      const result = check(['src/main.ts'], { author: 'OWNER', activity: AGENT_PUSHED });

      assert.equal(result.status, 0, result.stderr);
    });
  });

  describe('when who pushed is unknown', () => {
    it('fails an owner PR with no activity, as for a branch in a fork', () => {
      const result = check(['CLAUDE.md'], { author: 'OWNER', activity: null });

      assert.equal(result.status, 1);
      assert.match(result.stderr, /unknown/);
    });

    it('fails an owner PR whose newest push is not the head commit yet', () => {
      const result = check(['CLAUDE.md'], { author: 'OWNER', head: 'c4' });

      assert.equal(result.status, 1);
    });

    it('fails when the head commit appears only in an older push', () => {
      const result = check(['CLAUDE.md'], {
        author: 'OWNER',
        head: 'c2',
        approval: { actor: OWNER, timestamp: '2026-11-26T14:00:00Z' },
      });

      assert.equal(result.status, 1);
    });

    it('does not let a label approve it', () => {
      const result = check(['CLAUDE.md'], {
        activity: null,
        approval: { actor: OWNER, timestamp: '2026-11-26T14:00:00Z' },
      });

      assert.equal(result.status, 1);
    });

    it('fails when the environment says nothing', () => {
      const result = check(['CLAUDE.md'], { env: { PATH: process.env.PATH } });

      assert.equal(result.status, 1);
    });

    it('fails on activity that is not JSON', () => {
      const result = check(['CLAUDE.md'], {
        env: {
          PATH: process.env.PATH,
          AUTHOR_ASSOCIATION: 'OWNER',
          OWNER,
          HEAD_SHA: HEAD,
          ACTIVITY: 'not json',
        },
      });

      assert.equal(result.status, 1);
      assert.match(result.stderr, /ACTIVITY/);
    });
  });

  describe('the approval label', () => {
    it('passes guardrail changes the agent pushed once the owner labelled after its last push', () => {
      const result = check(['CLAUDE.md'], {
        activity: AGENT_PUSHED,
        approval: { actor: OWNER, timestamp: '2026-11-26T12:30:00Z' },
      });

      assert.equal(result.status, 0, result.stderr);
    });

    it('passes an owner PR the agent pushed to once the owner labelled after its last push', () => {
      const result = check(['CLAUDE.md'], {
        author: 'OWNER',
        activity: AGENT_PUSHED,
        approval: { actor: OWNER, timestamp: '2026-11-26T12:30:00Z' },
      });

      assert.equal(result.status, 0, result.stderr);
    });

    it('fails when someone else pushed after the owner labelled', () => {
      const result = check(['CLAUDE.md'], {
        activity: AGENT_PUSHED,
        approval: { actor: OWNER, timestamp: '2026-11-26T11:00:00Z' },
      });

      assert.equal(result.status, 1);
      assert.match(result.stderr, /after the last of those pushes/);
    });

    it('passes when only the owner pushed after labelling', () => {
      const result = check(['CLAUDE.md'], {
        activity: [entry('push', HEAD, OWNER, '2026-11-26T13:00:00Z'), ...AGENT_PUSHED.slice(1)],
        approval: { actor: OWNER, timestamp: '2026-11-26T11:00:00Z' },
      });

      assert.equal(result.status, 0, result.stderr);
    });

    it('fails when someone other than the owner added the label', () => {
      const result = check(['CLAUDE.md'], {
        activity: AGENT_PUSHED,
        approval: { actor: 'claude[bot]', timestamp: '2026-11-26T12:30:00Z' },
      });

      assert.equal(result.status, 1);
    });

    it('fails when the owner is unknown, whoever added the label', () => {
      const result = check(['CLAUDE.md'], {
        owner: '',
        activity: [entry('push', HEAD, '', '2026-11-26T12:00:00Z')],
        approval: { actor: '', timestamp: '2026-11-26T12:30:00Z' },
      });

      assert.equal(result.status, 1);
    });
  });
});
