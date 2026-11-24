/**
 * Where production is served (docs/adr/0002). Canonical addresses, Open Graph
 * URLs and the sitemap all point here, so a page found on a preview deployment
 * never competes with production in search results.
 *
 * Keep this module free of imports: `scripts/generate-sitemap.mjs` imports it in Node.
 */
export const SITE_ORIGIN = 'https://virutas.net';
