import type { ApplicationConfig } from '@angular/core';
import { provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, TitleStrategy } from '@angular/router';
import { routes } from './app.routes';
import { provideI18n } from './core/i18n/provide-i18n';
import { TranslatedTitleStrategy } from './core/i18n/translated-title-strategy';
import { providePageMeta } from './core/page-meta/page-meta';
import { provideLightPrint } from './core/print/provide-light-print';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideI18n(),
    provideLightPrint(),
    providePageMeta(),
    { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
  ],
};
