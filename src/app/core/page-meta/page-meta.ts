import type { EnvironmentProviders } from '@angular/core';
import {
  DOCUMENT,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
  Service,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta } from '@angular/platform-browser';
import type { RouterStateSnapshot } from '@angular/router';
import { NavigationEnd, Router, TitleStrategy } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { combineLatest, filter, map } from 'rxjs';
import { translatedPageTitle } from '../i18n/translated-title-strategy';
import { SITE_ORIGIN } from './site';

/** What a route's `data` tells search engines and link previews about its page. */
export interface PageMetaData {
  /** App-wide translation key of the page's description. Without one, the app's description. */
  readonly description?: string;
  /** Keeps the page out of search results (`noindex`), with no canonical address. */
  readonly noindex?: boolean;
}

/** The page a navigation ended on, before translation. */
interface Page {
  readonly titleKey: string | undefined;
  readonly descriptionKey: string;
  readonly noindex: boolean;
  /** Production's address of the page, without query or fragment. */
  readonly url: string;
}

@Service()
class PageMeta {
  private readonly meta = inject(Meta);

  private readonly document = inject(DOCUMENT);

  private readonly transloco = inject(TranslocoService);

  private readonly titleStrategy = inject(TitleStrategy);

  constructor() {
    const router = inject(Router);
    const pages = router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => this.pageAt(router.routerState.snapshot, event.urlAfterRedirects)),
    );
    // The translation emits once the active language's file is loaded, and again on every switch.
    combineLatest([pages, this.transloco.selectTranslation()])
      .pipe(takeUntilDestroyed())
      .subscribe(([page]) => {
        this.show(page);
      });
  }

  private pageAt(snapshot: RouterStateSnapshot, url: string): Page {
    let descriptionKey = 'app.description';
    let noindex = false;
    for (let route = snapshot.root.firstChild; route !== null; route = route.firstChild) {
      const data: PageMetaData = route.data;
      descriptionKey = data.description ?? descriptionKey;
      noindex ||= data.noindex === true;
    }
    const { pathname } = new URL(url, SITE_ORIGIN);
    return {
      titleKey: this.titleStrategy.buildTitle(snapshot),
      descriptionKey,
      noindex,
      url: `${SITE_ORIGIN}${pathname}`,
    };
  }

  private show(page: Page): void {
    const description = this.transloco.translate(page.descriptionKey);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({
      property: 'og:title',
      content: translatedPageTitle(this.transloco, page.titleKey),
    });
    this.meta.updateTag({ property: 'og:description', content: description });

    if (page.noindex) {
      this.meta.updateTag({ name: 'robots', content: 'noindex' });
      this.meta.removeTag('property="og:url"');
      this.canonicalLink()?.remove();
    } else {
      this.meta.removeTag('name="robots"');
      this.meta.updateTag({ property: 'og:url', content: page.url });
      this.canonicalLinkOrNew().href = page.url;
    }
  }

  private canonicalLink(): HTMLLinkElement | null {
    return this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  }

  private canonicalLinkOrNew(): HTMLLinkElement {
    const existing = this.canonicalLink();
    if (existing !== null) {
      return existing;
    }
    const link = this.document.createElement('link');
    link.rel = 'canonical';
    this.document.head.append(link);
    return link;
  }
}

/**
 * Keeps the page's description, Open Graph tags and canonical address in step
 * with the current route and the active language, as the title strategy does
 * for the title. `index.html` holds the tags that are the same on every page.
 */
export function providePageMeta(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideEnvironmentInitializer(() => {
      inject(PageMeta);
    }),
  ]);
}
