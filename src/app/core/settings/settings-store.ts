import { computed, inject, Service, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { getBrowserCultureLang, TranslocoService } from '@jsverse/transloco';
import { filter } from 'rxjs';
import type { ImperialPrecision } from '../../shared/measurement/show-length.calc';
import { IMPERIAL_PRECISIONS } from '../../shared/measurement/show-length.calc';
import type { UnitSystem } from '../../shared/measurement/unit-system';
import type { CutOptimizerDefaults } from './cut-optimizer-defaults.calc';
import { cutOptimizerDefaults } from './cut-optimizer-defaults.calc';
import type { Lang } from '../i18n/langs';
import { isLang } from '../i18n/langs';

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
  if (!Number.isFinite(millimetres) || millimetres < 0) {
    throw new RangeError('A length must be a finite number of millimetres, zero or more');
  }
  return millimetres;
}

/**
 * App-wide settings every Tool reads. They live in memory for the browser
 * session: they survive navigation but not a reload, and nothing is written
 * to browser storage.
 *
 * The language is Transloco's active language: setting it here switches
 * Transloco, and a switch made directly on Transloco shows up here.
 */
@Service()
export class SettingsStore {
  private readonly transloco = inject(TranslocoService);

  private readonly unitSystemState = signal(defaultUnitSystem(getBrowserCultureLang()));

  private readonly imperialPrecisionState = signal(DEFAULT_PRECISION);

  private readonly kerfState = signal<number | undefined>(undefined);

  private readonly trimState = signal<number | undefined>(undefined);

  private readonly minimumOffcutLengthState = signal<number | undefined>(undefined);

  /** The preferred Unit System. */
  readonly unitSystem = this.unitSystemState.asReadonly();

  /** The denominator Imperial lengths are rounded to: 16 shows lengths to the nearest 1/16". */
  readonly imperialPrecision = this.imperialPrecisionState.asReadonly();

  /**
   * The Kerf, Trim and minimum Offcut length new Cut Optimizer jobs start from, in
   * millimetres: what the user set, else the default for the Unit System.
   */
  readonly cutOptimizerDefaults = computed<CutOptimizerDefaults>(() => {
    const fallback = cutOptimizerDefaults(this.unitSystemState());
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

  setUnitSystem(unitSystem: UnitSystem): void {
    this.unitSystemState.set(unitSystem);
  }

  /** @throws RangeError when `precision` is not 8, 16, 32 or 64. */
  setImperialPrecision(precision: ImperialPrecision): void {
    if (!IMPERIAL_PRECISIONS.includes(precision)) {
      throw new RangeError(`Imperial precision must be one of ${IMPERIAL_PRECISIONS.join(', ')}`);
    }
    this.imperialPrecisionState.set(precision);
  }

  setLanguage(language: Lang): void {
    this.transloco.setActiveLang(language);
  }

  /** @throws RangeError when `millimetres` is negative or not a finite number. */
  setCutOptimizerKerf(millimetres: number): void {
    this.kerfState.set(validLength(millimetres));
  }

  /** @throws RangeError when `millimetres` is negative or not a finite number. */
  setCutOptimizerTrim(millimetres: number): void {
    this.trimState.set(validLength(millimetres));
  }

  /** @throws RangeError when `millimetres` is negative or not a finite number. */
  setCutOptimizerMinimumOffcutLength(millimetres: number): void {
    this.minimumOffcutLengthState.set(validLength(millimetres));
  }

  /** Goes back to the default for the Unit System. */
  resetCutOptimizerDefault(setting: CutOptimizerSetting): void {
    const state = {
      kerf: this.kerfState,
      trim: this.trimState,
      minimumOffcutLength: this.minimumOffcutLengthState,
    }[setting];
    state.set(undefined);
  }
}
