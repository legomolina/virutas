import { Service, signal } from '@angular/core';
import type { TypedCutListEntry } from './cut-list-entry.calc';
import { emptyCutListEntry } from './cut-list-entry.calc';
import type { CutOptimizerInput, CuttingPlan, StrategyId } from './cut-optimizer.calc';
import type { JobSettingsTexts } from './job-settings.calc';
import type { TypedStockEntry } from './stock-entry.calc';
import { emptyStockEntry } from './stock-entry.calc';

/** A generated Cutting Plan with the input it was generated from. */
export interface GeneratedPlan {
  readonly plan: CuttingPlan;
  readonly input: CutOptimizerInput;
}

/**
 * The Cut Optimizer job: the Stock, Cut List and job settings as typed, and the last Cutting
 * Plan. It lives in memory for the browser session: it survives leaving the Tool and coming
 * back, not a reload, and nothing is written to browser storage.
 */
@Service()
export class CutOptimizerStore {
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

  /** Keeps `plan` as the last Cutting Plan, with the `input` it was generated from. */
  keepCuttingPlan(plan: CuttingPlan, input: CutOptimizerInput): void {
    this.generatedState.set({ plan, input });
  }
}
