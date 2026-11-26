import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import {
  FakeSettingsStorage,
  provideFakeSettingsStorage,
} from '../../../testing/fake-settings-storage';
import { translocoTesting } from '../../../testing/transloco-testing';
import type { ImperialPrecision } from '../../shared/measurement/show-length.calc';
import type { UnitSystem } from '../../shared/measurement/unit-system';
import { SettingsStorage } from './settings-storage';
import { SettingsStore } from './settings-store';

function configure(
  browserLanguages: readonly string[],
  storage: SettingsStorage = new FakeSettingsStorage(),
): void {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(browserLanguages);
  TestBed.configureTestingModule({
    imports: [translocoTesting()],
    providers: [provideFakeSettingsStorage(storage)],
  });
}

function setUp(
  browserLanguages: readonly string[],
  storage: SettingsStorage = new FakeSettingsStorage(),
): SettingsStore {
  configure(browserLanguages, storage);
  return TestBed.inject(SettingsStore);
}

/** A storage the browser blocks: reading and writing both throw. */
class BlockedStorage extends SettingsStorage {
  load(): never {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  }

  save(): never {
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
  }

  watch(): () => void {
    return () => undefined;
  }
}

function activeLang(): string {
  return TestBed.inject(TranslocoService).getActiveLang();
}

describe('SettingsStore', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Unit System', () => {
    it('defaults to Imperial for an en-US browser', () => {
      const store = setUp(['en-US']);

      expect(store.unitSystem()).toBe('imperial');
    });

    it.each(['en-GB', 'es-ES'])('defaults to Metric for an %s browser', (browserLang) => {
      const store = setUp([browserLang]);

      expect(store.unitSystem()).toBe('metric');
    });

    it.each([
      ['es-ES', 'imperial'],
      ['en-US', 'metric'],
    ] as const)('can be changed from the %s default to %s', (browserLang, unitSystem) => {
      const store = setUp([browserLang]);

      store.setUnitSystem(unitSystem);

      expect(store.unitSystem()).toBe(unitSystem);
    });
  });

  describe('Imperial precision', () => {
    it('defaults to sixteenths of an inch', () => {
      const store = setUp(['en-US']);

      expect(store.imperialPrecision()).toBe(16);
    });

    it.each([8, 32, 64] as const)('can be set to %i', (precision) => {
      const store = setUp(['en-US']);

      store.setImperialPrecision(precision);

      expect(store.imperialPrecision()).toBe(precision);
    });

    it('can be set back to 16', () => {
      const store = setUp(['en-US']);
      store.setImperialPrecision(8);

      store.setImperialPrecision(16);

      expect(store.imperialPrecision()).toBe(16);
    });

    it.each([0, -16, 4, 12, 128, 16.5, Number.NaN])(
      'rejects %s and keeps the current precision',
      (precision) => {
        const store = setUp(['en-US']);
        store.setImperialPrecision(32);

        expect(() => {
          store.setImperialPrecision(precision as ImperialPrecision);
        }).toThrow(RangeError);
        expect(store.imperialPrecision()).toBe(32);
      },
    );
  });

  describe('Language', () => {
    it("starts as Transloco's active language, not the browser's", () => {
      configure(['en-US']);
      TestBed.inject(TranslocoService).setActiveLang('es');

      const store = TestBed.inject(SettingsStore);

      expect(store.language()).toBe('es');
    });

    it("changes Transloco's active language", () => {
      const store = setUp(['en-US']);

      store.setLanguage('es');

      expect(TestBed.inject(TranslocoService).getActiveLang()).toBe('es');
      expect(store.language()).toBe('es');
    });

    it('follows Transloco when another writer changes the language', () => {
      const store = setUp(['en-US']);

      TestBed.inject(TranslocoService).setActiveLang('es');

      expect(store.language()).toBe('es');
    });
  });

  describe('Cut Optimizer defaults', () => {
    it('follow the Metric Unit System until the user sets a value', () => {
      const store = setUp(['en-GB']);

      expect(store.cutOptimizerDefaults()).toEqual({
        kerfMillimetres: 3,
        trimMillimetres: 0,
        minimumOffcutLengthMillimetres: 300,
      });
    });

    it('follow the Imperial Unit System until the user sets a value', () => {
      const store = setUp(['en-GB']);

      store.setUnitSystem('imperial');

      expect(store.cutOptimizerDefaults()).toEqual({
        kerfMillimetres: 3.175,
        trimMillimetres: 0,
        minimumOffcutLengthMillimetres: 304.8,
      });
    });

    it('report which values the user has set', () => {
      const store = setUp(['en-GB']);
      expect(store.cutOptimizerSetByUser()).toEqual({
        kerf: false,
        trim: false,
        minimumOffcutLength: false,
      });

      store.setCutOptimizerKerf(2);
      store.setCutOptimizerMinimumOffcutLength(500);

      expect(store.cutOptimizerSetByUser()).toEqual({
        kerf: true,
        trim: false,
        minimumOffcutLength: true,
      });
    });

    it('keep a value the user set when the Unit System changes, and the rest follow it', () => {
      const store = setUp(['en-GB']);
      store.setCutOptimizerKerf(2);
      store.setCutOptimizerTrim(10);
      store.setCutOptimizerMinimumOffcutLength(500);

      store.setUnitSystem('imperial');

      expect(store.cutOptimizerDefaults()).toEqual({
        kerfMillimetres: 2,
        trimMillimetres: 10,
        minimumOffcutLengthMillimetres: 500,
      });
    });

    it('accept zero', () => {
      const store = setUp(['en-GB']);

      store.setCutOptimizerKerf(0);

      expect(store.cutOptimizerDefaults().kerfMillimetres).toBe(0);
      expect(store.cutOptimizerSetByUser().kerf).toBe(true);
    });

    it.each([
      [
        'kerf',
        { kerfMillimetres: 3.175, trimMillimetres: 10, minimumOffcutLengthMillimetres: 500 },
      ],
      ['trim', { kerfMillimetres: 2, trimMillimetres: 0, minimumOffcutLengthMillimetres: 500 }],
      [
        'minimumOffcutLength',
        { kerfMillimetres: 2, trimMillimetres: 10, minimumOffcutLengthMillimetres: 304.8 },
      ],
    ] as const)(
      'go back to following the Unit System when the %s is reset',
      (setting, expected) => {
        const store = setUp(['en-GB']);
        store.setCutOptimizerKerf(2);
        store.setCutOptimizerTrim(10);
        store.setCutOptimizerMinimumOffcutLength(500);
        store.setUnitSystem('imperial');

        store.resetCutOptimizerDefault(setting);

        expect(store.cutOptimizerDefaults()).toEqual(expected);
        expect(store.cutOptimizerSetByUser()[setting]).toBe(false);
      },
    );

    it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
      'reject %s and keep the current value',
      (millimetres) => {
        const store = setUp(['en-GB']);
        store.setCutOptimizerKerf(2);
        store.setCutOptimizerTrim(10);
        store.setCutOptimizerMinimumOffcutLength(500);

        expect(() => {
          store.setCutOptimizerKerf(millimetres);
        }).toThrow(RangeError);
        expect(() => {
          store.setCutOptimizerTrim(millimetres);
        }).toThrow(RangeError);
        expect(() => {
          store.setCutOptimizerMinimumOffcutLength(millimetres);
        }).toThrow(RangeError);
        expect(store.cutOptimizerDefaults()).toEqual({
          kerfMillimetres: 2,
          trimMillimetres: 10,
          minimumOffcutLengthMillimetres: 500,
        });
      },
    );
  });

  describe('saved Settings', () => {
    it('starts from the Settings saved on a previous visit', () => {
      const storage = new FakeSettingsStorage({
        version: 1,
        unitSystem: 'imperial',
        imperialPrecision: 32,
        language: 'es',
        cutOptimizer: {
          kerfMillimetres: 2.5,
          trimMillimetres: 10,
          minimumOffcutLengthMillimetres: 500,
        },
      });

      const store = setUp(['en-GB'], storage);

      expect(store.unitSystem()).toBe('imperial');
      expect(store.imperialPrecision()).toBe(32);
      expect(store.language()).toBe('es');
      expect(activeLang()).toBe('es');
      expect(store.cutOptimizerDefaults()).toEqual({
        kerfMillimetres: 2.5,
        trimMillimetres: 10,
        minimumOffcutLengthMillimetres: 500,
      });
      expect(store.cutOptimizerSetByUser()).toEqual({
        kerf: true,
        trim: true,
        minimumOffcutLength: true,
      });
    });

    it('saves nothing until a Setting is chosen', () => {
      const storage = new FakeSettingsStorage();

      setUp(['en-GB'], storage);

      expect(storage.saves).toEqual([]);
    });

    it('saves each Setting the woodworker chooses, and only those', () => {
      const storage = new FakeSettingsStorage();
      const store = setUp(['en-GB'], storage);

      store.setImperialPrecision(32);
      expect(storage.lastSaved).toEqual({ version: 1, imperialPrecision: 32 });

      store.setUnitSystem('imperial');
      store.setCutOptimizerKerf(2.5);
      store.setCutOptimizerTrim(0);
      store.setCutOptimizerMinimumOffcutLength(500);
      store.setLanguage('es');

      expect(storage.lastSaved).toEqual({
        version: 1,
        unitSystem: 'imperial',
        imperialPrecision: 32,
        language: 'es',
        cutOptimizer: {
          kerfMillimetres: 2.5,
          trimMillimetres: 0,
          minimumOffcutLengthMillimetres: 500,
        },
      });
    });

    it('saves a value chosen even when it matches the default', () => {
      const storage = new FakeSettingsStorage();
      const store = setUp(['en-GB'], storage);

      store.setUnitSystem('metric');
      store.setImperialPrecision(16);

      expect(storage.lastSaved).toEqual({
        version: 1,
        unitSystem: 'metric',
        imperialPrecision: 16,
      });
    });

    it.each([
      ['en-US', 'imperial'],
      ['es-ES', 'metric'],
    ] as const)(
      'keeps following an %s browser for a Unit System never chosen',
      (browserLang, unitSystem) => {
        const store = setUp(
          [browserLang],
          new FakeSettingsStorage({ version: 1, imperialPrecision: 8 }),
        );

        expect(store.unitSystem()).toBe(unitSystem);
      },
    );

    it('leaves the active language alone when no language was chosen', () => {
      configure(['en-US'], new FakeSettingsStorage({ version: 1, unitSystem: 'metric' }));
      TestBed.inject(TranslocoService).setActiveLang('es');

      const store = TestBed.inject(SettingsStore);

      expect(store.language()).toBe('es');
    });

    it('lets a Cut Optimizer default never chosen follow the Unit System', () => {
      const storage = new FakeSettingsStorage({
        version: 1,
        cutOptimizer: { trimMillimetres: 10 },
      });
      const store = setUp(['en-GB'], storage);

      store.setUnitSystem('imperial');

      expect(store.cutOptimizerDefaults()).toEqual({
        kerfMillimetres: 3.175,
        trimMillimetres: 10,
        minimumOffcutLengthMillimetres: 304.8,
      });
      expect(storage.lastSaved).toEqual({
        version: 1,
        unitSystem: 'imperial',
        cutOptimizer: { trimMillimetres: 10 },
      });
    });

    it('removes a Cut Optimizer default from what is saved when it is reset', () => {
      const storage = new FakeSettingsStorage({
        version: 1,
        cutOptimizer: {
          kerfMillimetres: 2,
          trimMillimetres: 10,
          minimumOffcutLengthMillimetres: 500,
        },
      });
      const store = setUp(['en-GB'], storage);

      store.resetCutOptimizerDefault('kerf');
      expect(storage.lastSaved).toStrictEqual({
        version: 1,
        cutOptimizer: { trimMillimetres: 10, minimumOffcutLengthMillimetres: 500 },
      });

      store.resetCutOptimizerDefault('minimumOffcutLength');
      expect(storage.lastSaved).toStrictEqual({
        version: 1,
        cutOptimizer: { trimMillimetres: 10 },
      });

      store.resetCutOptimizerDefault('trim');
      expect(storage.lastSaved).toStrictEqual({ version: 1 });
    });

    it('saves nothing for a value it rejects', () => {
      const storage = new FakeSettingsStorage();
      const store = setUp(['en-GB'], storage);

      expect(() => {
        store.setCutOptimizerKerf(-1);
      }).toThrow(RangeError);
      expect(() => {
        store.setCutOptimizerTrim(Number.NaN);
      }).toThrow(RangeError);
      expect(() => {
        store.setImperialPrecision(12 as ImperialPrecision);
      }).toThrow(RangeError);
      expect(() => {
        store.setUnitSystem('cubits' as UnitSystem);
      }).toThrow(RangeError);

      expect(storage.saves).toEqual([]);
      expect(store.unitSystem()).toBe('metric');
    });

    it('lets an invalid saved field fall back to its default and keeps the others', () => {
      const storage = new FakeSettingsStorage({
        version: 1,
        unitSystem: 'cubits',
        imperialPrecision: 64,
        language: 'fr',
        cutOptimizer: { kerfMillimetres: -3, minimumOffcutLengthMillimetres: 500 },
      });

      const store = setUp(['en-US'], storage);

      expect(store.unitSystem()).toBe('imperial');
      expect(store.imperialPrecision()).toBe(64);
      expect(store.language()).toBe('en');
      expect(store.cutOptimizerDefaults()).toEqual({
        kerfMillimetres: 3.175,
        trimMillimetres: 0,
        minimumOffcutLengthMillimetres: 500,
      });
    });

    it('ignores Settings saved in an unknown version', () => {
      const storage = new FakeSettingsStorage({
        version: 2,
        unitSystem: 'imperial',
        language: 'es',
      });

      const store = setUp(['en-GB'], storage);

      expect(store.unitSystem()).toBe('metric');
      expect(store.language()).toBe('en');
    });

    describe('language', () => {
      it("takes priority over the browser's language", () => {
        const store = setUp(['en-US'], new FakeSettingsStorage({ version: 1, language: 'es' }));

        expect(store.language()).toBe('es');
        expect(activeLang()).toBe('es');
      });

      it('saves a language changed directly on Transloco', () => {
        const storage = new FakeSettingsStorage();
        setUp(['en-GB'], storage);

        TestBed.inject(TranslocoService).setActiveLang('es');

        expect(storage.lastSaved).toEqual({ version: 1, language: 'es' });
      });

      it('applying the saved language does not count as a change to save', () => {
        const storage = new FakeSettingsStorage({ version: 1, language: 'es' });

        setUp(['en-GB'], storage);

        expect(storage.saves).toEqual([]);
      });
    });

    describe('when browser storage is blocked', () => {
      it('starts from the defaults', () => {
        const store = setUp(['en-US'], new BlockedStorage());

        expect(store.unitSystem()).toBe('imperial');
        expect(store.imperialPrecision()).toBe(16);
      });

      it('keeps Settings in memory, without an error', () => {
        const store = setUp(['en-GB'], new BlockedStorage());

        expect(() => {
          store.setUnitSystem('imperial');
          store.setImperialPrecision(64);
          store.setCutOptimizerKerf(2);
          store.resetCutOptimizerDefault('trim');
          store.setLanguage('es');
        }).not.toThrow();

        expect(store.unitSystem()).toBe('imperial');
        expect(store.imperialPrecision()).toBe(64);
        expect(store.cutOptimizerDefaults().kerfMillimetres).toBe(2);
        expect(store.language()).toBe('es');
      });
    });

    describe('changed in another tab', () => {
      it('are applied here without being saved again', () => {
        const storage = new FakeSettingsStorage();
        const store = setUp(['en-GB'], storage);

        storage.changeInAnotherTab({
          version: 1,
          unitSystem: 'imperial',
          imperialPrecision: 64,
          language: 'es',
          cutOptimizer: { kerfMillimetres: 2 },
        });

        expect(store.unitSystem()).toBe('imperial');
        expect(store.imperialPrecision()).toBe(64);
        expect(store.language()).toBe('es');
        expect(activeLang()).toBe('es');
        expect(store.cutOptimizerDefaults().kerfMillimetres).toBe(2);
        expect(store.cutOptimizerSetByUser().kerf).toBe(true);
        expect(storage.saves).toEqual([]);
      });

      it('go back to their defaults when the other tab no longer has them, language included', () => {
        const storage = new FakeSettingsStorage({
          version: 1,
          unitSystem: 'imperial',
          imperialPrecision: 64,
          language: 'en',
          cutOptimizer: { kerfMillimetres: 2 },
        });
        const store = setUp(['es-ES'], storage);

        storage.changeInAnotherTab(undefined);

        expect(store.unitSystem()).toBe('metric');
        expect(store.imperialPrecision()).toBe(16);
        expect(store.language()).toBe('es');
        expect(store.cutOptimizerSetByUser().kerf).toBe(false);
        expect(storage.saves).toEqual([]);
      });

      it('stay with this tab: a later change here saves them along with it', () => {
        const storage = new FakeSettingsStorage();
        const store = setUp(['en-GB'], storage);
        storage.changeInAnotherTab({ version: 1, language: 'es' });

        store.setImperialPrecision(8);

        expect(storage.lastSaved).toEqual({ version: 1, imperialPrecision: 8, language: 'es' });
      });
    });
  });
});
