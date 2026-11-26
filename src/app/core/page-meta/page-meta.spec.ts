import { TestBed } from '@angular/core/testing';
import { provideRouter, TitleStrategy } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoService } from '@jsverse/transloco';
import { testTool } from '../../../testing/test-tool/test-tool';
import { translocoTesting } from '../../../testing/transloco-testing';
import { appRoutes } from '../../app.routes';
import { TranslatedTitleStrategy } from '../i18n/translated-title-strategy';
import { providePageMeta } from './page-meta';

/** What search engines and link previews read from `<head>`. */
function head(): Record<string, string | null> {
  const content = (selector: string): string | null =>
    document.head.querySelector(selector)?.getAttribute('content') ?? null;
  return {
    title: document.title,
    description: content('meta[name="description"]'),
    ogTitle: content('meta[property="og:title"]'),
    ogDescription: content('meta[property="og:description"]'),
    ogUrl: content('meta[property="og:url"]'),
    canonical: document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
    robots: content('meta[name="robots"]'),
  };
}

/** The whole router with the real page routes, a test Tool, and page metadata on. */
async function setUp(): Promise<RouterTestingHarness> {
  TestBed.configureTestingModule({
    imports: [translocoTesting()],
    providers: [
      provideRouter(appRoutes([testTool()])),
      providePageMeta(),
      { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
    ],
  });
  return RouterTestingHarness.create();
}

describe('page metadata', () => {
  beforeAll(async () => {
    // The first navigation to a page loads its lazy component, which takes seconds in a cold test
    // run (about 4 s for the home page alone, more under a full parallel run). Load them once here,
    // under the hook timeout, so the first test does not spend its 5 s timeout on it.
    await Promise.all(appRoutes([testTool()]).map(async (route) => route.loadComponent?.()));
  });

  afterEach(() => {
    // jsdom keeps one document across tests: start each one from an empty head.
    document.head.replaceChildren();
  });

  it("describes the home page with the app's description, canonical at the site root", async () => {
    const harness = await setUp();

    await harness.navigateByUrl('/');

    expect(head()).toEqual({
      title: 'Virutas',
      description:
        'Woodworking calculators that run in your browser: convert measurements, set the Fence for a Bevel Cut and plan your Cuts with the least Waste.',
      ogTitle: 'Virutas',
      ogDescription:
        'Woodworking calculators that run in your browser: convert measurements, set the Fence for a Bevel Cut and plan your Cuts with the least Waste.',
      ogUrl: 'https://virutas.net/',
      canonical: 'https://virutas.net/',
      robots: null,
    });
  });

  it("describes a Tool's page with the Tool's description, canonical at its path", async () => {
    const harness = await setUp();

    await harness.navigateByUrl('/test-tool');

    expect(head()).toEqual({
      title: 'Test Tool – Virutas',
      description: 'A Tool for tests.',
      ogTitle: 'Test Tool – Virutas',
      ogDescription: 'A Tool for tests.',
      ogUrl: 'https://virutas.net/test-tool',
      canonical: 'https://virutas.net/test-tool',
      robots: null,
    });
  });

  it('describes the settings page with its own description', async () => {
    const harness = await setUp();

    await harness.navigateByUrl('/settings');

    expect(head()).toEqual({
      title: 'Settings – Virutas',
      description:
        'Choose the Unit System, Imperial precision, language and defaults the Tools start with.',
      ogTitle: 'Settings – Virutas',
      ogDescription:
        'Choose the Unit System, Imperial precision, language and defaults the Tools start with.',
      ogUrl: 'https://virutas.net/settings',
      canonical: 'https://virutas.net/settings',
      robots: null,
    });
  });

  it('leaves the query and fragment out of the canonical address', async () => {
    const harness = await setUp();

    await harness.navigateByUrl('/test-tool?from=home#result');

    expect(head()).toEqual(
      expect.objectContaining({
        ogUrl: 'https://virutas.net/test-tool',
        canonical: 'https://virutas.net/test-tool',
      }),
    );
  });

  it('keeps the not-found page out of search results, with no canonical address', async () => {
    const harness = await setUp();
    await harness.navigateByUrl('/test-tool');

    await harness.navigateByUrl('/no-such-page');

    expect(head()).toEqual(
      expect.objectContaining({
        title: 'Page not found – Virutas',
        ogUrl: null,
        canonical: null,
        robots: 'noindex',
      }),
    );
  });

  it('lets search engines index a page again after leaving the not-found page', async () => {
    const harness = await setUp();
    await harness.navigateByUrl('/no-such-page');

    await harness.navigateByUrl('/settings');

    expect(head()).toEqual(
      expect.objectContaining({ robots: null, canonical: 'https://virutas.net/settings' }),
    );
  });

  it('keeps a single description and canonical link however many pages are visited', async () => {
    const harness = await setUp();

    await harness.navigateByUrl('/');
    await harness.navigateByUrl('/test-tool');
    await harness.navigateByUrl('/settings');

    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
  });

  it('updates the existing tags from index.html instead of adding a second set', async () => {
    document.head.insertAdjacentHTML(
      'beforeend',
      '<meta name="description" content="Static"><meta property="og:title" content="Static">',
    );
    const harness = await setUp();

    await harness.navigateByUrl('/test-tool');

    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('meta[property="og:title"]')).toHaveLength(1);
    expect(head()).toEqual(
      expect.objectContaining({ description: 'A Tool for tests.', ogTitle: 'Test Tool – Virutas' }),
    );
  });

  it('translates the description and Open Graph title when the language changes', async () => {
    const harness = await setUp();
    await harness.navigateByUrl('/settings');

    TestBed.inject(TranslocoService).setActiveLang('es');

    expect(head()).toEqual(
      expect.objectContaining({
        description:
          'Elige el sistema de medida, la precisión imperial, el idioma y los valores con los que empiezan las herramientas.',
        ogTitle: 'Ajustes – Virutas',
        ogDescription:
          'Elige el sistema de medida, la precisión imperial, el idioma y los valores con los que empiezan las herramientas.',
        canonical: 'https://virutas.net/settings',
      }),
    );
  });

  it("describes the home page in Spanish with the app's Spanish description", async () => {
    const harness = await setUp();
    await harness.navigateByUrl('/');

    TestBed.inject(TranslocoService).setActiveLang('es');

    expect(head()).toEqual(
      expect.objectContaining({
        description:
          'Calculadoras de carpintería que funcionan en tu navegador: convierte medidas, coloca la guía paralela para un corte a bisel y planifica tus cortes con el menor desperdicio.',
        canonical: 'https://virutas.net/',
      }),
    );
  });

  it('keeps the not-found page out of search results after the language changes', async () => {
    const harness = await setUp();
    await harness.navigateByUrl('/no-such-page');

    TestBed.inject(TranslocoService).setActiveLang('es');

    expect(head()).toEqual(
      expect.objectContaining({
        title: 'Página no encontrada – Virutas',
        ogUrl: null,
        canonical: null,
        robots: 'noindex',
      }),
    );
  });
});
