// Generates public/sitemap.xml: the home page, the settings page and every Tool
// in the Tool registry, on production's origin. Generated, so a new Tool cannot
// be left out.
//
//   pnpm sitemap         write public/sitemap.xml
//   pnpm sitemap:check   fail if it is out of date (part of `pnpm lint`)
//
// `--out <path>` overrides the file. The registry and the origin are read from
// their TypeScript modules, which Node runs by stripping their types.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

/** Pages outside the Tool registry that search engines should find (see app.routes.ts). */
const PAGES = ['/', '/settings'];

/** The sitemap of `paths` (each starting with `/`) on `origin`, in the given order. */
export function sitemapXml(origin, paths) {
  const urls = paths.map((path) => `  <url><loc>${origin}${path}</loc></url>\n`).join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!-- Generated from the Tool registry by scripts/generate-sitemap.mjs. Do not edit. -->\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls +
    '</urlset>\n'
  );
}

function readIfExists(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
}

async function main() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const { values } = parseArgs({
    options: {
      check: { type: 'boolean', default: false },
      out: { type: 'string', default: resolve(root, 'public/sitemap.xml') },
    },
  });

  const { TOOLS } = await import('../src/app/core/tool-registry/tools.ts');
  const { SITE_ORIGIN } = await import('../src/app/core/page-meta/site.ts');
  const expected = sitemapXml(SITE_ORIGIN, [...PAGES, ...TOOLS.map(({ path }) => `/${path}`)]);

  if (!values.check) {
    writeFileSync(values.out, expected);
    return;
  }
  if (readIfExists(values.out) !== expected) {
    console.error(
      `${values.out} is out of date with the Tool registry.\n` +
        'Run `pnpm sitemap` to regenerate it; never edit sitemap.xml by hand.',
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
