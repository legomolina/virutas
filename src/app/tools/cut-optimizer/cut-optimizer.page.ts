import {
  afterNextRender,
  Component,
  computed,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { SettingsStore } from '../../core/settings/settings-store';
import { Button } from '../../shared/ui/button/button';
import { CutListSection } from './components/cut-list-section/cut-list-section';
import { CuttingPlanView } from './components/cutting-plan/cutting-plan';
import { JobSettingsSection } from './components/job-settings-section/job-settings-section';
import { StockSection } from './components/stock-section/stock-section';
import type { TypedCutListEntry } from './cut-list-entry.calc';
import { emptyCutListEntry } from './cut-list-entry.calc';
import type { CutOptimizerInput, CuttingPlan, StrategyId } from './cut-optimizer.calc';
import { planCuts } from './cut-optimizer.calc';
import { readCuttingPlanRequest } from './cutting-plan-request.calc';
import { editableLength } from './editable-length';
import type { JobSettingsTexts } from './job-settings.calc';
import type { TypedStockEntry } from './stock-entry.calc';
import { emptyStockEntry } from './stock-entry.calc';

/** A generated Cutting Plan with the input it was generated from. */
interface GeneratedPlan {
  readonly plan: CuttingPlan;
  readonly input: CutOptimizerInput;
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

  /** The last Cutting Plan generated, if any. */
  protected readonly generated = signal<GeneratedPlan | undefined>(undefined);

  /** Builds the Cutting Plan from the current input and moves focus to its summary. */
  protected generate(): void {
    const request = this.request();
    if (!request.ok) {
      return;
    }
    this.generated.set({ plan: planCuts(request.input), input: request.input });
    afterNextRender(() => this.cuttingPlan()?.focusSummary(), { injector: this.injector });
  }
}
