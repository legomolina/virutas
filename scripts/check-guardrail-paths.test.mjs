import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('check-guardrail-paths.mjs', import.meta.url));

/** Runs the check on the given changed paths, as a PR by `author`. */
function check(paths, { author = 'NONE', approved = false } = {}) {
  return spawnSync(process.execPath, [SCRIPT], {
    input: paths.join('\n'),
    encoding: 'utf8',
    env: { ...process.env, AUTHOR_ASSOCIATION: author, APPROVED: approved ? 'true' : 'false' },
  });
}

describe('check-guardrail-paths', () => {
  it('passes a PR by someone else that changes no guardrail', () => {
    const result = check([
      'src/app/tools/cut-optimizer/cut-optimizer.calc.ts',
      'public/i18n/es.json',
    ]);

    assert.equal(result.status, 0, result.stderr);
  });

  for (const path of [
    '.github/workflows/ci.yml',
    '.github/workflows/new.yml',
    '.claude/settings.json',
    '.claude/hooks/stop.sh',
    '.githooks/pre-commit',
    'docs/agents/implement-issue.md',
    'scripts/check-translations.mjs',
    'stylelint/rules/some-rule.mjs',
    'CLAUDE.md',
    'package.json',
    'eslint.config.mjs',
    'tsconfig.json',
    'stryker.config.mjs',
  ]) {
    it(`fails a PR by someone else that changes ${path}`, () => {
      const result = check(['src/main.ts', path]);

      assert.equal(result.status, 1);
      assert.match(
        result.stderr,
        new RegExp(`^  ${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'),
      );
    });
  }

  it('lists every guardrail touched, once each', () => {
    const result = check(['scripts/a.mjs', 'CLAUDE.md', 'scripts/a.mjs', 'src/main.ts'], {
      author: 'CONTRIBUTOR',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /^ {2}CLAUDE\.md\n {2}scripts\/a\.mjs\n/m);
    assert.doesNotMatch(result.stderr, /src\/main\.ts/);
  });

  it('fails when a guardrail is renamed away, since the old path is listed too', () => {
    const result = check(['scripts/check-translations.mjs', 'tools-old/check-translations.mjs']);

    assert.equal(result.status, 1);
  });

  it('does not treat a path that only starts like a guardrail file as one', () => {
    const result = check([
      'CLAUDE.md.bak',
      'docs/agents-notes.md',
      'src/scripts/x.ts',
      'e2e/package.json',
    ]);

    assert.equal(result.status, 0, result.stderr);
  });

  it('treats a collaborator or member like anyone else', () => {
    assert.equal(check(['CLAUDE.md'], { author: 'COLLABORATOR' }).status, 1);
    assert.equal(check(['CLAUDE.md'], { author: 'MEMBER' }).status, 1);
  });

  it('passes guardrail changes in a PR opened by the owner', () => {
    const result = check(['.github/workflows/ci.yml', 'CLAUDE.md'], { author: 'OWNER' });

    assert.equal(result.status, 0, result.stderr);
  });

  it('passes guardrail changes the owner approved with the label', () => {
    const result = check(['.claude/settings.json'], { approved: true });

    assert.equal(result.status, 0, result.stderr);
  });

  it('fails when the author association is missing', () => {
    const result = spawnSync(process.execPath, [SCRIPT], {
      input: 'CLAUDE.md',
      encoding: 'utf8',
      env: { PATH: process.env.PATH },
    });

    assert.equal(result.status, 1);
  });
});
