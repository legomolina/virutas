import { inject, Service } from '@angular/core';
import { LocalSettingsStorage } from './local-settings-storage';
import type { SettingsDocument } from './settings-document.calc';

/**
 * Where the settings store keeps the Settings the woodworker chose (ADR 0005).
 * Synchronous, so the app starts from them at once. Browser storage by
 * default; a future account sync plugs in here, without the Tools or the
 * store's interface changing.
 */
@Service({ factory: () => inject(LocalSettingsStorage) })
export abstract class SettingsStorage {
  /** What was saved, unchecked: anything, or `undefined` when nothing was. */
  abstract load(): unknown;

  abstract save(document: SettingsDocument): void;

  /**
   * Calls `listener` with what was saved, unchecked, each time it changes
   * elsewhere (another tab), never for this app's own `save()`.
   *
   * @returns A function that stops watching.
   */
  abstract watch(listener: (saved: unknown) => void): () => void;
}
