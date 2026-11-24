import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { sitemapXml } from './generate-sitemap.mjs';

const SCRIPT = fileURLToPath(new URL('generate-sitemap.mjs', import.meta.url));

/** Runs the generator CLI with its output in a temp folder. */
function runCli(...flags) {
  const out = join(mkdtempSync(join(tmpdir(), 'sitemap-')), 'sitemap.xml');
  const run = (...args) =>
    spawnSync(process.execPath, [SCRIPT, ...args, '--out', out], { encoding: 'utf8' });
  return { run, out, first: run(...flags) };
}

describe('sitemapXml', () => {
  it('lists each page at its address on the site, in order', () => {
    assert.equal(
      sitemapXml('https://example.org', ['/', '/settings', '/cut-optimizer']),
      `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated from the Tool registry by scripts/generate-sitemap.mjs. Do not edit. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.org/</loc></url>
  <url><loc>https://example.org/settings</loc></url>
  <url><loc>https://example.org/cut-optimizer</loc></url>
</urlset>
`,
    );
  });
});

describe('generate-sitemap CLI', () => {
  it('writes the home page, the settings page and every registered Tool on virutas.net', () => {
    const { out, first } = runCli();

    assert.equal(first.status, 0, first.stderr);
    const locs = [...readFileSync(out, 'utf8').matchAll(/<loc>(.*?)<\/loc>/g)].map(
      (match) => match[1],
    );
    assert.deepEqual(locs, [
      'https://virutas.net/',
      'https://virutas.net/settings',
      'https://virutas.net/unit-converter',
      'https://virutas.net/bevel-fence-calculator',
      'https://virutas.net/cut-optimizer',
    ]);
  });

  it('--check passes when the sitemap is up to date', () => {
    const { run } = runCli();

    const check = run('--check');

    assert.equal(check.status, 0, check.stderr);
  });

  it('--check fails, naming the fix, when the sitemap misses a page', () => {
    const { run, out } = runCli();
    writeFileSync(
      out,
      readFileSync(out, 'utf8').replace(/ {2}<url><loc>[^\n]*cut-optimizer.*\n/, ''),
    );

    const check = run('--check');

    assert.equal(check.status, 1);
    assert.match(check.stderr, /pnpm sitemap/);
  });

  it('--check fails when there is no sitemap yet', () => {
    const out = join(mkdtempSync(join(tmpdir(), 'sitemap-')), 'sitemap.xml');

    const check = spawnSync(process.execPath, [SCRIPT, '--check', '--out', out], {
      encoding: 'utf8',
    });

    assert.equal(check.status, 1);
    assert.match(check.stderr, /pnpm sitemap/);
  });
});
