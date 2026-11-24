import { expect, test } from '@playwright/test';
import en from '../public/i18n/en.json';
import { TOOLS } from '../src/app/core/tool-registry/tools';
import { translationAt } from '../src/testing/tool-pages';
import { appRoutes } from './routes';

const NOT_FOUND = '/no-such-page';

/** Every page search engines should find: all of them but the not-found page. */
const indexedPaths = appRoutes.map(({ path }) => path).filter((path) => path !== NOT_FOUND);

/**
 * Each indexed page's English description. index.html already holds the home page's, so
 * matching every page's own text proves the app replaced it.
 */
const DESCRIPTION_KEYS: Readonly<Record<string, string>> = {
  '/': 'app.description',
  '/settings': 'settings.description',
  ...Object.fromEntries(TOOLS.map(({ path, descriptionKey }) => [`/${path}`, descriptionKey])),
};

function descriptionOf(path: string): string {
  const description = translationAt(en, DESCRIPTION_KEYS[path] ?? '');
  if (description === undefined) {
    throw new Error(`No English description for ${path}.`);
  }
  return description;
}

/** A PNG's size, read from its IHDR chunk. */
function pngSize(body: Buffer): { width: number; height: number } {
  return { width: body.readUInt32BE(16), height: body.readUInt32BE(20) };
}

// Single-page apps answer unknown paths with index.html: the content type and
// the file's own text prove the file itself was served.

test('robots.txt lets crawlers in and points them at the sitemap', async ({ request }) => {
  const response = await request.get('/robots.txt');

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^text\/plain/);
  expect(await response.text()).toBe(
    'User-agent: *\nAllow: /\n\nSitemap: https://virutas.net/sitemap.xml\n',
  );
});

test('the sitemap lists every page but the not-found page, on virutas.net', async ({ request }) => {
  const response = await request.get('/sitemap.xml');

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/xml/);
  const locs = [...(await response.text()).matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  expect([...locs].sort()).toEqual(indexedPaths.map((path) => `https://virutas.net${path}`).sort());
});

test("index.html describes the site with the app's English description, for previews without JavaScript", async ({
  request,
}) => {
  const html = await (await request.get('/')).text();

  const content = descriptionOf('/').replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const name of ['name="description"', 'property="og:description"']) {
    expect(html).toMatch(new RegExp(`<meta\\s+${name}\\s+content="${content}"`));
  }
});

test('serves the 1200 x 630 link preview image that index.html declares', async ({
  page,
  request,
}) => {
  await page.goto('/');
  const declared = page.locator('meta[property="og:image"]');
  await expect(declared).toHaveAttribute('content', 'https://virutas.net/og-image.png');

  // Fetched from the server under test: production only has it once this is deployed.
  const response = await request.get('/og-image.png');

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^image\/png/);
  expect(pngSize(await response.body())).toEqual({ width: 1200, height: 630 });
});

for (const path of indexedPaths) {
  test(`${path} has its own description, title and canonical address on virutas.net`, async ({
    page,
  }) => {
    await page.goto(path);

    const canonical = `https://virutas.net${path}`;
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      descriptionOf(path),
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      await page.title(),
    );
    // The app has run (the canonical link above is its own), so a robots tag would be there by now.
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });
}

test('the not-found page stays out of search results', async ({ page }) => {
  await page.goto(NOT_FOUND);
  // Wait for the app, so the missing canonical link below is its doing.
  await expect(page).toHaveTitle('Page not found – Virutas');

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
});

test.describe('in a Spanish browser', () => {
  test.use({ locale: 'es-ES' });

  test("describes a Tool's page in Spanish, replacing index.html's English", async ({ page }) => {
    await page.goto('/cut-optimizer');

    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'Planifica cómo cortar tus piezas del material para dejar el mínimo desperdicio.',
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      'Optimizador de cortes – Virutas',
    );
  });
});
