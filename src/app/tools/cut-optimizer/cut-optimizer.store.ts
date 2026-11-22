import { computed, inject, Service, signal } from '@angular/core';
import type { CutOptimizerDefaults } from '../../core/settings/cut-optimizer-defaults.calc';
import { SettingsStore } from '../../core/settings/settings-store';
import type { UnitSystem } from '../../shared/measurement/unit-system';
import type { TypedCutListEntry } from './cut-list-entry.calc';
import { emptyCutListEntry } from './cut-list-entry.calc';
import type { CutOptimizerInput, CuttingPlan, StrategyId } from './cut-optimizer.calc';
import type { JobSettingsTexts } from './job-settings.calc';
import type { TypedStockEntry } from './stock-entry.calc';
import { emptyStockEntry } from './stock-entry.calc';

/**
 * Everything the engine's input is read from, at one moment. Compared by identity: any change
 * makes a new one, even a change back to an earlier value.
 */
export interface InputSnapshot {
  readonly stock: readonly TypedStockEntry[];
  readonly cutList: readonly TypedCutListEntry[];
  readonly jobSettingsEdits: Partial<JobSettingsTexts>;
  readonly strategy: StrategyId;
  readonly defaults: CutOptimizerDefaults;
  readonly unitSystem: UnitSystem;
}

/** A generated Cutting Plan with the input it was generated from. */
export interface GeneratedPlan {
  readonly plan: CuttingPlan;
  readonly input: CutOptimizerInput;
  /** What was typed and set when the plan was generated. */
  readonly inputSnapshot: InputSnapshot;
}

/**
 * The Cut Optimizer job: the Stock, Cut List and job settings as typed, and the last Cutting
 * Plan. It lives in memory for the browser session: it survives leaving the Tool and coming
 * back, not a reload, and nothing is written to browser storage.
 */
@Service()
export class CutOptimizerStore {
  private readonly settings = inject(SettingsStore);

  private readonly stockState = signal<readonly TypedStockEntry[]>([emptyStockEntry([])]);
  private readonly cutListState = signal<readonly TypedCutListEntry[]>([emptyCutListEntry([])]);
  private readonly jobSettingsEditsState = signal<Partial<JobSettingsTexts>>({});
  private readonly strategyState = signal<StrategyId>('fewest-stock');
  private readonly generatedState = signal<GeneratedPlan | undefined>(undefined);

  /** The Stock entries as typed; a new job starts with one empty entry. */
  readonly stock = this.stockState.asReadonly();

  /** The Cut List as typed; a new job starts with one empty Part. */
  readonly cutList = this.cutListState.asReadonly();

  /** The job settings changed in this job, as typed; the others follow the defaults. */
  readonly jobSettingsEdits = this.jobSettingsEditsState.asReadonly();

  /** The Strategy the Cutting Plan is built with. */
  readonly strategy = this.strategyState.asReadonly();

  /** The last Cutting Plan generated, with its input, if any. */
  readonly generated = this.generatedState.asReadonly();

  /**
   * Everything the engine's input is read from, as it is now. Changing the language or the
   * precision does not change it: they change how lengths are shown, not the input.
   */
  readonly inputSnapshot = computed<InputSnapshot>(() => ({
    stock: this.stockState(),
    cutList: this.cutListState(),
    jobSettingsEdits: this.jobSettingsEditsState(),
    strategy: this.strategyState(),
    defaults: this.settings.cutOptimizerDefaults(),
    unitSystem: this.settings.unitSystem(),
  }));

  /** Whether any input changed since the Cutting Plan was generated. Undoing it does not count. */
  readonly outOfDate = computed(() => {
    const generated = this.generatedState();
    return generated !== undefined && generated.inputSnapshot !== this.inputSnapshot();
  });

  setStock(entries: readonly TypedStockEntry[]): void {
    this.stockState.set(entries);
  }

  setCutList(entries: readonly TypedCutListEntry[]): void {
    this.cutListState.set(entries);
  }

  setJobSettingsEdits(edits: Partial<JobSettingsTexts>): void {
    this.jobSettingsEditsState.set(edits);
  }

  setStrategy(strategy: StrategyId): void {
    this.strategyState.set(strategy);
  }

  /**
   * Keeps `plan` as the last Cutting Plan, with the engine's `input` it was built from and the
   * `inputSnapshot` taken when building started, so a change made meanwhile marks it out of date.
   */
  keepCuttingPlan(plan: CuttingPlan, input: CutOptimizerInput, inputSnapshot: InputSnapshot): void {
    this.generatedState.set({ plan, input, inputSnapshot });
  }

  /** Drops the last Cutting Plan, when it no longer matches what was asked for. */
  dropCuttingPlan(): void {
    this.generatedState.set(undefined);
  }
}
