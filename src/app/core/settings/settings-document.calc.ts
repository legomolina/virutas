import type { ImperialPrecision } from '../../shared/measurement/show-length.calc';
import { IMPERIAL_PRECISIONS } from '../../shared/measurement/show-length.calc';
import type { UnitSystem } from '../../shared/measurement/unit-system';
import type { Lang } from '../i18n/langs';
import { isLang } from '../i18n/langs';

/** The version of the saved Settings format this app reads and writes. */
const VERSION = 1;

/**
 * The Settings the woodworker chose. A value left out was never chosen and
 * follows its default: the browser for the Unit System and the language, the
 * Unit System for the Cut Optimizer defaults.
 */
export interface ChosenSettings {
  readonly unitSystem?: UnitSystem;
  readonly imperialPrecision?: ImperialPrecision;
  readonly language?: Lang;
  readonly kerfMillimetres?: number;
  readonly trimMillimetres?: number;
  readonly minimumOffcutLengthMillimetres?: number;
}

/** The chosen Settings as they are saved: versioned, each Tool's defaults grouped under the Tool. */
export interface SettingsDocument {
  readonly version: typeof VERSION;
  readonly unitSystem?: UnitSystem;
  readonly imperialPrecision?: ImperialPrecision;
  readonly language?: Lang;
  readonly cutOptimizer?: {
    readonly kerfMillimetres?: number;
    readonly trimMillimetres?: number;
    readonly minimumOffcutLengthMillimetres?: number;
  };
}

export function isUnitSystem(value: unknown): value is UnitSystem {
  return value === 'metric' || value === 'imperial';
}

/** 8, 16, 32 or 64: the fractions of an inch Imperial lengths can be shown to. */
export function isImperialPrecision(value: unknown): value is ImperialPrecision {
  return (IMPERIAL_PRECISIONS as readonly unknown[]).includes(value);
}

/** A length a Setting can hold: a finite number of millimetres, zero or more. */
export function isSettingLength(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The document to save for the Settings the woodworker chose, leaving out every value they did not. */
export function settingsDocument(chosen: ChosenSettings): SettingsDocument {
  const { unitSystem, imperialPrecision, language } = chosen;
  const { kerfMillimetres, trimMillimetres, minimumOffcutLengthMillimetres } = chosen;
  const cutOptimizer = {
    ...(kerfMillimetres === undefined ? {} : { kerfMillimetres }),
    ...(trimMillimetres === undefined ? {} : { trimMillimetres }),
    ...(minimumOffcutLengthMillimetres === undefined ? {} : { minimumOffcutLengthMillimetres }),
  };
  return {
    version: VERSION,
    ...(unitSystem === undefined ? {} : { unitSystem }),
    ...(imperialPrecision === undefined ? {} : { imperialPrecision }),
    ...(language === undefined ? {} : { language }),
    ...(Object.keys(cutOptimizer).length > 0 ? { cutOptimizer } : {}),
  };
}

/**
 * The chosen Settings in what was saved, each field checked with the same
 * rules as the settings store's setters. An invalid field is left out, so it
 * falls back to its default, and the others are kept. Data in an unknown
 * version, or that is not a document at all, gives nothing.
 */
export function chosenSettings(saved: unknown): ChosenSettings {
  if (!isRecord(saved) || saved['version'] !== VERSION) {
    return {};
  }
  const { unitSystem, imperialPrecision, language } = saved;
  const cutOptimizer = isRecord(saved['cutOptimizer']) ? saved['cutOptimizer'] : {};
  const { kerfMillimetres, trimMillimetres, minimumOffcutLengthMillimetres } = cutOptimizer;
  return {
    ...(isUnitSystem(unitSystem) ? { unitSystem } : {}),
    ...(isImperialPrecision(imperialPrecision) ? { imperialPrecision } : {}),
    ...(typeof language === 'string' && isLang(language) ? { language } : {}),
    ...(isSettingLength(kerfMillimetres) ? { kerfMillimetres } : {}),
    ...(isSettingLength(trimMillimetres) ? { trimMillimetres } : {}),
    ...(isSettingLength(minimumOffcutLengthMillimetres) ? { minimumOffcutLengthMillimetres } : {}),
  };
}
