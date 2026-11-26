import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('check-guardrail-paths.mjs', import.meta.url));

/**
 * Runs the check on the given changed paths, in a repo owned by `owner`, as a
 * PR whose author has the association `author` and whose `guardrails-approved`
 * label (if any) was added by `approvedBy`.
 */
function check(paths, { author = 'NONE', owner = 'the-owner', approvedBy = '', env } = {}) {
  return spawnSync(process.execPath, [SCRIPT], {
    input: paths.join('\n'),
    encoding: 'utf8',
    env: env ?? {
      PATH: process.env.PATH,
      AUTHOR_ASSOCIATION: author,
      OWNER: owner,
      APPROVED_BY: approvedBy,
    },
  });
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('check-guardrail-paths', () => {
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
    const result = check(['scripts/a.mjs', 'CLAUDE.md', 'scripts/a.mjs', 'src/main.ts'], {
      author: 'CONTRIBUTOR',
    });

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

  it('treats a collaborator, a member or a lower-case "owner" like anyone else', () => {
    for (const author of ['COLLABORATOR', 'MEMBER', 'owner']) {
      assert.equal(check(['CLAUDE.md'], { author }).status, 1, author);
    }
  });

  it('passes guardrail changes in a PR opened by the owner', () => {
    const result = check(['.github/workflows/ci.yml', 'CLAUDE.md'], { author: 'OWNER' });

    assert.equal(result.status, 0, result.stderr);
  });

  it('passes guardrail changes when the owner added the label', () => {
    const result = check(['.claude/settings.json'], {
      owner: 'the-owner',
      approvedBy: 'the-owner',
    });

    assert.equal(result.status, 0, result.stderr);
  });

  it('fails guardrail changes when someone other than the owner added the label', () => {
    const result = check(['.claude/settings.json'], {
      owner: 'the-owner',
      approvedBy: 'claude[bot]',
    });

    assert.equal(result.status, 1);
  });

  it('fails when neither the owner nor the approver is known', () => {
    const result = check(['CLAUDE.md'], { owner: '', approvedBy: '' });

    assert.equal(result.status, 1);
  });

  it('fails when the environment says nothing about the author or the label', () => {
    const result = check(['CLAUDE.md'], { env: { PATH: process.env.PATH } });

    assert.equal(result.status, 1);
  });
});
