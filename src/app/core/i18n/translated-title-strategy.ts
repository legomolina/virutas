import { inject, Service } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import type { RouterStateSnapshot } from '@angular/router';
import { TitleStrategy } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { BehaviorSubject, combineLatest } from 'rxjs';

/**
 * The title of a page whose route `title` is `pageKey` (a translation key), in
 * the active language: "<page> – <app name>", or the app name alone without one.
 * Page metadata reuses it, so link previews show the same title as the tab.
 */
export function translatedPageTitle(
  transloco: TranslocoService,
  pageKey: string | undefined,
): string {
  const appName = transloco.translate('app.name');
  if (pageKey === undefined) {
    return appName;
  }
  const page: string = transloco.translate(pageKey);
  return transloco.translate('app.pageTitle', { page, appName });
}

/**
 * Builds the document title from translation keys: a route's `title` is an
 * app-wide translation key (a Tool's route uses the Tool's name key), shown as
 * "<page> – <app name>"; a page without one is titled with the app name alone.
 * The title follows the active language, since it is what screen readers
 * announce on navigation (WCAG 2.4.2).
 */
@Service()
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  private readonly transloco = inject(TranslocoService);

  private readonly pageKey = new BehaviorSubject<string | undefined>(undefined);

  constructor() {
    super();
    // Emits once the active language's file is loaded, and again on every switch.
    combineLatest([this.pageKey, this.transloco.selectTranslation()])
      .pipe(takeUntilDestroyed())
      .subscribe(([pageKey]) => {
        this.title.setTitle(translatedPageTitle(this.transloco, pageKey));
      });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.pageKey.next(this.buildTitle(snapshot));
  }
}
