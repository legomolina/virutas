import { computed, DestroyRef, inject, Service, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { getBrowserCultureLang, getBrowserLang, TranslocoService } from '@jsverse/transloco';
import { filter, skip } from 'rxjs';
import type { ImperialPrecision } from '../../shared/measurement/show-length.calc';
import { IMPERIAL_PRECISIONS } from '../../shared/measurement/show-length.calc';
import type { UnitSystem } from '../../shared/measurement/unit-system';
import { initialLang } from '../i18n/initial-lang';
import type { Lang } from '../i18n/langs';
import { isLang } from '../i18n/langs';
import type { CutOptimizerDefaults } from './cut-optimizer-defaults.calc';
import { cutOptimizerDefaults } from './cut-optimizer-defaults.calc';
import type { ChosenSettings } from './settings-document.calc';
import {
  chosenSettings,
  isImperialPrecision,
  isSettingLength,
  isUnitSystem,
  settingsDocument,
} from './settings-document.calc';
import { SettingsStorage } from './settings-storage';

/** The Cut Optimizer settings a woodworker can set a default for. */
export type CutOptimizerSetting = 'kerf' | 'trim' | 'minimumOffcutLength';

/** Which Cut Optimizer defaults the user has set, as opposed to following the Unit System. */
export type CutOptimizerSetByUser = Readonly<Record<CutOptimizerSetting, boolean>>;

/** Lengths are shown to the nearest 1/16" until the user picks another precision. */
const DEFAULT_PRECISION: ImperialPrecision = 16;

/** Imperial for a US English browser (`en-US`), Metric for every other locale. */
function defaultUnitSystem(browserLocale: string | undefined): UnitSystem {
  return browserLocale?.toLowerCase() === 'en-us' ? 'imperial' : 'metric';
}

function validLength(millimetres: number): number {
  if (!isSettingLength(millimetres)) {
    throw new RangeError('A length must be a finite number of millimetres, zero or more');
  }
  return millimetres;
}

/**
 * App-wide settings every Tool reads, saved in the browser (ADR 0005) through
 * `SettingsStorage`. Only the values the woodworker chose are saved; the rest
 * keep following their defaults (the browser, or the Unit System for the Cut
 * Optimizer defaults). A change saved in another tab is applied here.
 *
 * The language is Transloco's active language: setting it here switches
 * Transloco, and a switch made directly on Transloco shows up here and is
 * saved. A saved language is applied as soon as the store is created, which
 * the i18n initializer does before the app starts.
 */
@Service()
export class SettingsStore {
  private readonly transloco = inject(TranslocoService);

  private readonly storage = inject(SettingsStorage);

  private readonly browserUnitSystem = defaultUnitSystem(getBrowserCultureLang());

  private readonly unitSystemState = signal<UnitSystem | undefined>(undefined);

  private readonly imperialPrecisionState = signal<ImperialPrecision | undefined>(undefined);

  private readonly kerfState = signal<number | undefined>(undefined);

  private readonly trimState = signal<number | undefined>(undefined);

  private readonly minimumOffcutLengthState = signal<number | undefined>(undefined);

  /** The language the woodworker chose, or `undefined` while it follows the browser. */
  private chosenLanguage: Lang | undefined;

  /** True while the store itself switches Transloco, so that switch is not saved as a choice. */
  private applying = false;

  /** The preferred Unit System. */
  readonly unitSystem = computed(() => this.unitSystemState() ?? this.browserUnitSystem);

  /** The denominator Imperial lengths are rounded to: 16 shows lengths to the nearest 1/16". */
  readonly imperialPrecision = computed(() => this.imperialPrecisionState() ?? DEFAULT_PRECISION);

  /**
   * The Kerf, Trim and minimum Offcut length new Cut Optimizer jobs start from, in
   * millimetres: what the user set, else the default for the Unit System.
   */
  readonly cutOptimizerDefaults = computed<CutOptimizerDefaults>(() => {
    const fallback = cutOptimizerDefaults(this.unitSystem());
    return {
      kerfMillimetres: this.kerfState() ?? fallback.kerfMillimetres,
      trimMillimetres: this.trimState() ?? fallback.trimMillimetres,
      minimumOffcutLengthMillimetres:
        this.minimumOffcutLengthState() ?? fallback.minimumOffcutLengthMillimetres,
    };
  });

  /** Which of those the user has set, so a settings field can tell a chosen value from a default. */
  readonly cutOptimizerSetByUser = computed<CutOptimizerSetByUser>(() => ({
    kerf: this.kerfState() !== undefined,
    trim: this.trimState() !== undefined,
    minimumOffcutLength: this.minimumOffcutLengthState() !== undefined,
  }));

  /** The language the UI is shown in. */
  readonly language = toSignal(this.transloco.langChanges$.pipe(filter(isLang)), {
    requireSync: true,
  });

  constructor() {
    this.apply(this.loadSaved(), { languageFallback: undefined });
    // The first value is the language now active, not a change.
    const languageChanges = this.transloco.langChanges$
      .pipe(skip(1), filter(isLang))
      .subscribe((language) => {
        this.languageChanged(language);
      });
    const stopWatching = this.storage.watch((saved) => {
      this.apply(chosenSettings(saved), { languageFallback: initialLang(getBrowserLang()) });
    });
    inject(DestroyRef).onDestroy(() => {
      languageChanges.unsubscribe();
      stopWatching();
    });
  }

  /** @throws RangeError when `unitSystem` is not Metric or Imperial. */
  setUnitSystem(unitSystem: UnitSystem): void {
    if (!isUnitSystem(unitSystem)) {
      throw new RangeError('The Unit System must be metric or imperial');
    }
    this.unitSystemState.set(unitSystem);
    this.save();
  }

  /** @throws RangeError when `precision` is not 8, 16, 32 or 64. */
  setImperialPrecision(precision: ImperialPrecision): void {
    if (!isImperialPrecision(precision)) {
      throw new RangeError(`Imperial precision must be one of ${IMPERIAL_PRECISIONS.join(', ')}`);
    }
    this.imperialPrecisionState.set(precision);
    this.save();
  }

  /** Switches Transloco, which this store follows and saves. */
  setLanguage(language: Lang): void {
    this.transloco.setActiveLang(language);
  }

  /** @throws RangeError when `millimetres` is negative or not a finite number. */
  setCutOptimizerKerf(millimetres: number): void {
    this.kerfState.set(validLength(millimetres));
    this.save();
  }

  /** @throws RangeError when `millimetres` is negative or not a finite number. */
  setCutOptimizerTrim(millimetres: number): void {
    this.trimState.set(validLength(millimetres));
    this.save();
  }

  /** @throws RangeError when `millimetres` is negative or not a finite number. */
  setCutOptimizerMinimumOffcutLength(millimetres: number): void {
    this.minimumOffcutLengthState.set(validLength(millimetres));
    this.save();
  }

  /** Goes back to the default for the Unit System, and stops saving the value. */
  resetCutOptimizerDefault(setting: CutOptimizerSetting): void {
    const state = {
      kerf: this.kerfState,
      trim: this.trimState,
      minimumOffcutLength: this.minimumOffcutLengthState,
    }[setting];
    state.set(undefined);
    this.save();
  }

  /**
   * Puts every Setting back to its default: the language to the browser's, the
   * Unit System to the browser's, and everything else to its own default. Nothing
   * chosen stays saved.
   */
  resetAll(): void {
    this.apply({}, { languageFallback: initialLang(getBrowserLang()) });
    this.save();
  }

  private languageChanged(language: Lang): void {
    if (this.applying) {
      return;
    }
    this.chosenLanguage = language;
    this.save();
  }

  /**
   * Takes on `chosen` without saving it. A language not chosen switches
   * Transloco to `languageFallback`, or leaves it alone when that is undefined.
   */
  private apply(
    chosen: ChosenSettings,
    { languageFallback }: { readonly languageFallback: Lang | undefined },
  ): void {
    this.unitSystemState.set(chosen.unitSystem);
    this.imperialPrecisionState.set(chosen.imperialPrecision);
    this.kerfState.set(chosen.kerfMillimetres);
    this.trimState.set(chosen.trimMillimetres);
    this.minimumOffcutLengthState.set(chosen.minimumOffcutLengthMillimetres);
    this.chosenLanguage = chosen.language;
    const language = chosen.language ?? languageFallback;
    if (language !== undefined && language !== this.transloco.getActiveLang()) {
      this.applying = true;
      try {
        this.transloco.setActiveLang(language);
      } finally {
        this.applying = false;
      }
    }
  }

  /** What was saved, or nothing when storage cannot be read. */
  private loadSaved(): ChosenSettings {
    try {
      return chosenSettings(this.storage.load());
    } catch {
      return {};
    }
  }

  /** Saves the chosen Settings, best effort: when storage fails they stay in memory. */
  private save(): void {
    try {
      this.storage.save(
        settingsDocument({
          unitSystem: this.unitSystemState(),
          imperialPrecision: this.imperialPrecisionState(),
          language: this.chosenLanguage,
          kerfMillimetres: this.kerfState(),
          trimMillimetres: this.trimState(),
          minimumOffcutLengthMillimetres: this.minimumOffcutLengthState(),
        }),
      );
    } catch {
      // Blocked, private mode or full: Settings stay in memory.
    }
  }
}
