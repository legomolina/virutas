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
import { SettingsStore } from '../../core/settings/settings-store';
import { Button } from '../../shared/ui/button/button';
import { CutListSection } from './components/cut-list-section/cut-list-section';
import { CuttingPlanView } from './components/cutting-plan/cutting-plan';
import { JobSettingsSection } from './components/job-settings-section/job-settings-section';
import { StockSection } from './components/stock-section/stock-section';
import { CutOptimizerStore } from './cut-optimizer.store';
import { readCuttingPlanRequest } from './cutting-plan-request.calc';
import { CUTTING_PLANNER } from './cutting-planner';
import { editableLength } from './editable-length';
import type { JobSettingsTexts } from './job-settings.calc';

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
  /** The job, kept for the session so it is still here when the woodworker comes back. */
  protected readonly job = inject(CutOptimizerStore);
  private readonly injector = inject(Injector);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly planner = inject(CUTTING_PLANNER);

  private readonly cuttingPlan = viewChild(CuttingPlanView);

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

  /** How lengths are shown: the global precision, in the page's language. */
  protected readonly lengthOptions = computed(() => ({
    precision: this.settings.imperialPrecision(),
    language: this.settings.language(),
  }));

  /** The engine's input read from what is typed, or why the Cutting Plan cannot be generated. */
  protected readonly request = computed(() =>
    readCuttingPlanRequest(
      {
        stock: this.job.stock(),
        cutList: this.job.cutList(),
        jobSettings: { ...this.jobSettingsDefaults(), ...this.job.jobSettingsEdits() },
        strategy: this.job.strategy(),
      },
      this.settings.unitSystem(),
    ),
  );

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
    const inputSnapshot = this.job.inputSnapshot();
    this.generation.set('building');
    const done = this.pendingTasks.add();
    try {
      this.job.keepCuttingPlan(await this.planner(request.input), request.input, inputSnapshot);
      this.generation.set('idle');
      afterNextRender(() => this.cuttingPlan()?.focusSummary(), { injector: this.injector });
    } catch {
      this.job.dropCuttingPlan();
      this.generation.set('failed');
    } finally {
      done();
    }
  }
}
