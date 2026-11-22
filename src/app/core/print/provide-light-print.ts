import type { EnvironmentProviders } from '@angular/core';
import {
  DOCUMENT,
  DestroyRef,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from '@angular/core';

/**
 * Prints in the light theme whatever the screen theme is: paper is white, so light text from the
 * dark theme would be unreadable on it. While the page is printed (or print media is emulated),
 * `<html>` gets `data-theme="light"`, which `tokens.css` honours over `prefers-color-scheme`;
 * afterwards it gets back whatever it had.
 */
export function provideLightPrint(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideEnvironmentInitializer(() => {
      const document = inject(DOCUMENT);
      const window = document.defaultView;
      if (window === null) {
        return;
      }
      const root = document.documentElement;
      /** The theme `<html>` had before printing; `null` when it had none. */
      let screenTheme: string | null = null;
      let printing = false;

      const startPrinting = (): void => {
        if (printing) {
          return;
        }
        printing = true;
        screenTheme = root.getAttribute('data-theme');
        root.setAttribute('data-theme', 'light');
      };
      const stopPrinting = (): void => {
        if (!printing) {
          return;
        }
        printing = false;
        if (screenTheme === null) {
          root.removeAttribute('data-theme');
        } else {
          root.setAttribute('data-theme', screenTheme);
        }
      };
      const followPrintMedia = (event: MediaQueryListEvent): void => {
        if (event.matches) {
          startPrinting();
        } else {
          stopPrinting();
        }
      };

      const printMedia = window.matchMedia('print');
      window.addEventListener('beforeprint', startPrinting);
      window.addEventListener('afterprint', stopPrinting);
      printMedia.addEventListener('change', followPrintMedia);
      inject(DestroyRef).onDestroy(() => {
        window.removeEventListener('beforeprint', startPrinting);
        window.removeEventListener('afterprint', stopPrinting);
        printMedia.removeEventListener('change', followPrintMedia);
      });
    }),
  ]);
}
