import { DOCUMENT, inject, Service } from '@angular/core';
import type { SettingsDocument } from './settings-document.calc';
import type { SettingsStorage } from './settings-storage';

/** The `localStorage` key the Settings document is saved under. */
const KEY = 'virutas.settings';

/** The JSON in `text`, or `undefined` when there is none or it cannot be read. */
function parsed(text: string | null): unknown {
  if (text === null) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Settings saved in the browser's `localStorage`, best effort: when the browser
 * blocks storage or it is full, nothing loads and saving does nothing, so the
 * app keeps Settings in memory.
 */
@Service()
export class LocalSettingsStorage implements SettingsStorage {
  private readonly window = inject(DOCUMENT).defaultView;

  load(): unknown {
    try {
      return parsed(this.window?.localStorage.getItem(KEY) ?? null);
    } catch {
      return undefined;
    }
  }

  save(document: SettingsDocument): void {
    try {
      this.window?.localStorage.setItem(KEY, JSON.stringify(document));
    } catch {
      // Blocked, private mode or full: Settings stay in memory.
    }
  }

  watch(listener: (saved: unknown) => void): () => void {
    const { window } = this;
    if (window === null) {
      return () => undefined;
    }
    // `key` is null when another tab cleared the whole storage.
    const onStorage = (event: StorageEvent): void => {
      const fromLocalStorage =
        event.storageArea !== null && event.storageArea === this.localStorage();
      if (fromLocalStorage && (event.key === KEY || event.key === null)) {
        listener(parsed(event.newValue));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
    };
  }

  /** The browser's `localStorage`, or `undefined` when it is blocked (reading it can throw). */
  private localStorage(): Storage | undefined {
    try {
      return this.window?.localStorage;
    } catch {
      return undefined;
    }
  }
}
