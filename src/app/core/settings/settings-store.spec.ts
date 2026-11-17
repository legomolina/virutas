import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { translocoTesting } from '../../../testing/transloco-testing';
import type { ImperialPrecision } from '../../shared/measurement/show-length.calc';
import { SettingsStore } from './settings-store';

function configure(browserLanguages: readonly string[]): void {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(browserLanguages);
  TestBed.configureTestingModule({ imports: [translocoTesting()] });
}

function setUp(browserLanguages: readonly string[]): SettingsStore {
  configure(browserLanguages);
  return TestBed.inject(SettingsStore);
}

describe('SettingsStore', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

  it('writes nothing to browser storage', () => {
    localStorage.clear();
    sessionStorage.clear();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    // jsdom has no IndexedDB: stand one in so any use is recorded.
    const openDatabase = vi.fn();
    vi.stubGlobal('indexedDB', { open: openDatabase });
    const store = setUp(['en-US']);

    store.setUnitSystem('metric');
    store.setImperialPrecision(64);
    store.setLanguage('es');

    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage).toHaveLength(0);
    expect(sessionStorage).toHaveLength(0);
    expect(openDatabase).not.toHaveBeenCalled();
  });
});
