import type { UnitSystem } from '../../shared/measurement/unit-system';
import type { CutListEntryTexts } from './cut-list-entry.calc';
import { readCutListEntry } from './cut-list-entry.calc';
import type { CutOptimizerInput, StrategyId } from './cut-optimizer.calc';
import type { JobSettingsTexts } from './job-settings.calc';
import { readJobSettings } from './job-settings.calc';
import type { StockEntryTexts } from './stock-entry.calc';
import { readStockEntry } from './stock-entry.calc';

/** Everything the woodworker typed or chose to generate a Cutting Plan. */
export interface CuttingPlanRequestTexts {
  readonly stock: readonly StockEntryTexts[];
  readonly cutList: readonly CutListEntryTexts[];
  readonly jobSettings: JobSettingsTexts;
  readonly strategy: StrategyId;
}

/**
 * Why a Cutting Plan cannot be generated yet, most pressing first: `invalid-fields`, a value that
 * cannot be used; `incomplete-entries`, an entry filled in only in part; `missing-entries`, no
 * Stock or no Part to plan with.
 */
export type CuttingPlanBlocker = 'invalid-fields' | 'incomplete-entries' | 'missing-entries';

export type CuttingPlanRequest =
  | { readonly ok: true; readonly input: CutOptimizerInput }
  | { readonly ok: false; readonly reason: CuttingPlanBlocker };

/** Whether every text of an entry is empty; anything that is not text, such as its id, is not typed. */
function isBlank(entry: object): boolean {
  return Object.values(entry).every((value) => typeof value !== 'string' || value.trim() === '');
}

interface Reading<T> {
  readonly errors: object;
  readonly entry?: T;
}

/** Whether any entry has a value that cannot be used. */
function hasErrors(readings: readonly Reading<unknown>[]): boolean {
  return readings.some((reading) => Object.keys(reading.errors).length > 0);
}

/**
 * Reads what the woodworker typed into the engine's input, or says why it cannot be generated
 * yet. Entries left completely blank are left out, so an unused row does not block generating.
 */
export function readCuttingPlanRequest(
  texts: CuttingPlanRequestTexts,
  unitSystem: UnitSystem,
): CuttingPlanRequest {
  const stock = texts.stock
    .filter((entry) => !isBlank(entry))
    .map((entry) => readStockEntry(entry, unitSystem));
  const cutList = texts.cutList
    .filter((entry) => !isBlank(entry))
    .map((entry) => readCutListEntry(entry, unitSystem));
  // Job settings come back only when every one of them can be used.
  const { settings } = readJobSettings(texts.jobSettings, unitSystem);

  if (hasErrors([...stock, ...cutList]) || settings === undefined) {
    return { ok: false, reason: 'invalid-fields' };
  }
  const stockEntries = stock.flatMap((reading) => (reading.entry ? [reading.entry] : []));
  const parts = cutList.flatMap((reading) => (reading.entry ? [reading.entry] : []));
  if (stockEntries.length < stock.length || parts.length < cutList.length) {
    return { ok: false, reason: 'incomplete-entries' };
  }
  if (stockEntries.length === 0 || parts.length === 0) {
    return { ok: false, reason: 'missing-entries' };
  }
  return {
    ok: true,
    input: {
      stock: stockEntries,
      cutList: parts,
      settings: { ...settings, strategy: texts.strategy },
    },
  };
}
