import {
  afterNextRender,
  Component,
  computed,
  inject,
  Injector,
  PendingTasks,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { CutOptimizerDefaults } from '../../core/settings/cut-optimizer-defaults.calc';
import { SettingsStore } from '../../core/settings/settings-store';
import type { UnitSystem } from '../../shared/measurement/unit-system';
import { Button } from '../../shared/ui/button/button';
import { CutListSection } from './components/cut-list-section/cut-list-section';
import { CuttingPlanView } from './components/cutting-plan/cutting-plan';
import { JobSettingsSection } from './components/job-settings-section/job-settings-section';
import { StockSection } from './components/stock-section/stock-section';
import type { TypedCutListEntry } from './cut-list-entry.calc';
import { emptyCutListEntry } from './cut-list-entry.calc';
import type { CutOptimizerInput, CuttingPlan, StrategyId } from './cut-optimizer.calc';
import { readCuttingPlanRequest } from './cutting-plan-request.calc';
import { CUTTING_PLANNER } from './cutting-planner';
import { editableLength } from './editable-length';
import type { JobSettingsTexts } from './job-settings.calc';
import type { TypedStockEntry } from './stock-entry.calc';
import { emptyStockEntry } from './stock-entry.calc';

/**
 * Everything the engine's input is read from, at one moment. Compared by identity: any change
 * makes a new one, even a change back to an earlier value.
 */
interface InputSnapshot {
  readonly stock: readonly TypedStockEntry[];
  readonly cutList: readonly TypedCutListEntry[];
  readonly jobSettingsEdits: Partial<JobSettingsTexts>;
  readonly strategy: StrategyId;
  readonly defaults: CutOptimizerDefaults;
  readonly unitSystem: UnitSystem;
}

/** A generated Cutting Plan with the input it was generated from. */
interface GeneratedPlan {
  readonly plan: CuttingPlan;
  readonly input: CutOptimizerInput;
  /** What was typed and set when the plan was generated. */
  readonly inputSnapshot: InputSnapshot;
}

/** The Cut Optimizer's page. */
@Component({
  selector: 'wt-cut-optimizer-page',
  imports: [
    TranslocoPipe,
    Button,
    StockSection,
    CutListSection,
    JobSettingsSection,
    CuttingPlanView,
  ],
  templateUrl: './cut-optimizer.page.html',
  styleUrl: './cut-optimizer.page.css',
})
export default class CutOptimizerPage {
  protected readonly settings = inject(SettingsStore);
  private readonly injector = inject(Injector);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly planner = inject(CUTTING_PLANNER);

  private readonly cuttingPlan = viewChild(CuttingPlanView);

  /** The Stock entries as typed; the page starts with one empty entry. */
  protected readonly stock = signal<readonly TypedStockEntry[]>([emptyStockEntry([])]);

  /** The Cut List as typed; the page starts with one empty Part. */
  protected readonly cutList = signal<readonly TypedCutListEntry[]>([emptyCutListEntry([])]);

  /**
   * The Cut Optimizer defaults as text, in the preferred Unit System. A job setting shows its
   * default until it is changed on this page.
   */
  protected readonly jobSettingsDefaults = computed<JobSettingsTexts>(() => {
    const defaults = this.settings.cutOptimizerDefaults();
    const unitSystem = this.settings.unitSystem();
    const options = this.lengthOptions();
    return {
      kerf: editableLength(defaults.kerfMillimetres, unitSystem, options),
      trim: editableLength(defaults.trimMillimetres, unitSystem, options),
      minimumOffcutLength: editableLength(
        defaults.minimumOffcutLengthMillimetres,
        unitSystem,
        options,
      ),
    };
  });

  /** The job settings changed on this page, as typed; the defaults are never changed here. */
  protected readonly jobSettingsEdits = signal<Partial<JobSettingsTexts>>({});

  /** The Strategy the Cutting Plan is built with. */
  protected readonly strategy = signal<StrategyId>('fewest-stock');

  /** How lengths are shown: the global precision, in the page's language. */
  protected readonly lengthOptions = computed(() => ({
    precision: this.settings.imperialPrecision(),
    language: this.settings.language(),
  }));

  /** The engine's input read from what is typed, or why the Cutting Plan cannot be generated. */
  protected readonly request = computed(() =>
    readCuttingPlanRequest(
      {
        stock: this.stock(),
        cutList: this.cutList(),
        jobSettings: { ...this.jobSettingsDefaults(), ...this.jobSettingsEdits() },
        strategy: this.strategy(),
      },
      this.settings.unitSystem(),
    ),
  );

  /**
   * Everything the engine's input is read from, as it is now. Changing the language or the
   * precision does not change it: they change how lengths are shown, not the input.
   */
  private readonly inputSnapshot = computed<InputSnapshot>(() => ({
    stock: this.stock(),
    cutList: this.cutList(),
    jobSettingsEdits: this.jobSettingsEdits(),
    strategy: this.strategy(),
    defaults: this.settings.cutOptimizerDefaults(),
    unitSystem: this.settings.unitSystem(),
  }));

  /** The last Cutting Plan generated, if any. */
  protected readonly generated = signal<GeneratedPlan | undefined>(undefined);

  /** Whether any input changed since the Cutting Plan was generated. Undoing it does not count. */
  protected readonly outOfDate = computed(() => {
    const generated = this.generated();
    return generated !== undefined && generated.inputSnapshot !== this.inputSnapshot();
  });

  /**
   * Where generating stands: `building` while a Cutting Plan is built (it cannot be generated
   * again meanwhile), `failed` when the last one could not be built.
   */
  protected readonly generation = signal<'idle' | 'building' | 'failed'>('idle');

  /** The messages that explain the Generate action: why it is blocked, or that it failed. */
  protected readonly generateDescription = computed(() => {
    const ids = [
      ...(this.request().ok ? [] : ['generate-blocked']),
      ...(this.generation() === 'failed' ? ['generate-failed'] : []),
    ];
    return ids.length > 0 ? ids.join(' ') : null;
  });

  /**
   * Builds the Cutting Plan from the current input and moves focus to its summary. The plan is
   * a pending task, so the page is not stable until it arrives. When it cannot be built, the
   * previous plan is dropped, since it no longer matches what was asked for. The input is noted
   * before building, so a change made meanwhile marks the new plan out of date.
   */
  protected async generate(): Promise<void> {
    const request = this.request();
    if (!request.ok || this.generation() === 'building') {
      return;
    }
    const inputSnapshot = this.inputSnapshot();
    this.generation.set('building');
    const done = this.pendingTasks.add();
    try {
      this.generated.set({
        plan: await this.planner(request.input),
        input: request.input,
        inputSnapshot,
      });
      this.generation.set('idle');
      afterNextRender(() => this.cuttingPlan()?.focusSummary(), { injector: this.injector });
    } catch {
      this.generated.set(undefined);
      this.generation.set('failed');
    } finally {
      done();
    }
  }
}
