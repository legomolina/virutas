import { TestBed } from '@angular/core/testing';
import { LocalSettingsStorage } from './local-settings-storage';
import { SettingsStorage } from './settings-storage';

const KEY = 'virutas.settings';

type Listener = (saved: unknown) => void;

function blocked(): never {
  throw new DOMException('The operation is insecure.', 'SecurityError');
}

/** What another tab writing `newValue` under `key` looks like to this one. */
function changeInAnotherTab(key: string | null, newValue: string | null): void {
  window.dispatchEvent(new StorageEvent('storage', { key, newValue, storageArea: localStorage }));
}

describe('LocalSettingsStorage', () => {
  let storage: SettingsStorage;

  beforeEach(() => {
    localStorage.clear();
    storage = TestBed.inject(SettingsStorage);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('is the storage Settings are saved to', () => {
    expect(storage).toBeInstanceOf(LocalSettingsStorage);
  });

  it('loads nothing when nothing was saved', () => {
    expect(storage.load()).toBeUndefined();
  });

  it('loads back what it saved', () => {
    storage.save({ version: 1, language: 'es', cutOptimizer: { kerfMillimetres: 2.5 } });

    expect(storage.load()).toEqual({
      version: 1,
      language: 'es',
      cutOptimizer: { kerfMillimetres: 2.5 },
    });
  });

  it('saves under a single key, as JSON', () => {
    storage.save({ version: 1, unitSystem: 'imperial' });

    expect(localStorage).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(KEY) ?? 'null')).toEqual({
      version: 1,
      unitSystem: 'imperial',
    });
  });

  it('loads nothing from corrupted data', () => {
    localStorage.setItem(KEY, '{"version":1,');

    expect(storage.load()).toBeUndefined();
  });

  it('loads nothing when the browser blocks reading', () => {
    localStorage.setItem(KEY, '{"version":1}');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);

    expect(storage.load()).toBeUndefined();
  });

  it('carries on when the browser refuses to save', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);

    expect(() => {
      storage.save({ version: 1, unitSystem: 'metric' });
    }).not.toThrow();
    expect(localStorage).toHaveLength(0);
  });

  describe('watching other tabs', () => {
    it('reports what another tab saved', () => {
      const listener = vi.fn<Listener>();
      storage.watch(listener);

      changeInAnotherTab(KEY, '{"version":1,"imperialPrecision":32}');

      expect(listener).toHaveBeenCalledExactlyOnceWith({ version: 1, imperialPrecision: 32 });
    });

    it('reports nothing saved when another tab removed it or cleared storage', () => {
      const listener = vi.fn<Listener>();
      storage.watch(listener);

      changeInAnotherTab(KEY, null);
      changeInAnotherTab(null, null);

      expect(listener.mock.calls).toEqual([[undefined], [undefined]]);
    });

    it('reports nothing saved when another tab saved corrupted data', () => {
      const listener = vi.fn<Listener>();
      storage.watch(listener);

      changeInAnotherTab(KEY, 'not json');

      expect(listener).toHaveBeenCalledExactlyOnceWith(undefined);
    });

    it('ignores changes to other keys', () => {
      const listener = vi.fn<Listener>();
      storage.watch(listener);

      changeInAnotherTab('something-else', '{"version":1}');

      expect(listener).not.toHaveBeenCalled();
    });

    it('ignores changes to session storage, even under the same key', () => {
      const listener = vi.fn<Listener>();
      storage.watch(listener);

      window.dispatchEvent(
        new StorageEvent('storage', {
          key: KEY,
          newValue: '{"version":1}',
          storageArea: sessionStorage,
        }),
      );
      window.dispatchEvent(new StorageEvent('storage', { key: null, storageArea: sessionStorage }));

      expect(listener).not.toHaveBeenCalled();
    });

    it('does not write the change back', () => {
      const setItem = vi.spyOn(Storage.prototype, 'setItem');
      storage.watch(vi.fn<Listener>());

      changeInAnotherTab(KEY, '{"version":1,"unitSystem":"metric"}');

      expect(setItem).not.toHaveBeenCalled();
    });

    it('stops reporting once the watch is ended', () => {
      const listener = vi.fn<Listener>();
      const stop = storage.watch(listener);

      stop();
      changeInAnotherTab(KEY, '{"version":1}');

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
