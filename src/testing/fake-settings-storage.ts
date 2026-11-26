import type { Provider } from '@angular/core';
import type { SettingsDocument } from '../app/core/settings/settings-document.calc';
import { SettingsStorage } from '../app/core/settings/settings-storage';

/**
 * An in-memory stand-in for the browser storage Settings are saved to, so
 * specs start from what they choose and leave nothing behind for the next one.
 */
export class FakeSettingsStorage extends SettingsStorage {
  private readonly listeners = new Set<(saved: unknown) => void>();

  private saved: unknown;

  /** Every document saved, oldest first. */
  readonly saves: SettingsDocument[] = [];

  /** @param saved What a previous visit left saved, unchecked. */
  constructor(saved?: unknown) {
    super();
    this.saved = saved;
  }

  /** The last document saved, or `undefined` when nothing was saved. */
  get lastSaved(): SettingsDocument | undefined {
    return this.saves.at(-1);
  }

  load(): unknown {
    return this.saved;
  }

  save(document: SettingsDocument): void {
    this.saved = document;
    this.saves.push(document);
  }

  watch(listener: (saved: unknown) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Another tab saves `saved`: what a `storage` event reports. */
  changeInAnotherTab(saved: unknown): void {
    this.saved = saved;
    this.listeners.forEach((listener) => {
      listener(saved);
    });
  }
}

/** Provides `storage` (an empty one unless given) as the storage Settings are saved to. */
export function provideFakeSettingsStorage(
  storage: SettingsStorage = new FakeSettingsStorage(),
): Provider {
  return { provide: SettingsStorage, useValue: storage };
}
