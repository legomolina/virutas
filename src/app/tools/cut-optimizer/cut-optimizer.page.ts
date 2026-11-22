import { afterNextRender, Component, computed, inject, Injector, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { SettingsStore } from '../../core/settings/settings-store';
import { Button } from '../../shared/ui/button/button';
import { CutListSection } from './components/cut-list-section/cut-list-section';
import { CuttingPlanView } from './components/cutting-plan/cutting-plan';
import { JobSettingsSection } from './components/job-settings-section/job-settings-section';
import { StockSection } from './components/stock-section/stock-section';
import { planCuts } from './cut-optimizer.calc';
import { CutOptimizerStore } from './cut-optimizer.store';
import { readCuttingPlanRequest } from './cutting-plan-request.calc';
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

  /** Builds the Cutting Plan from the current input and moves focus to its summary. */
  protected generate(): void {
    const request = this.request();
    if (!request.ok) {
      return;
    }
    this.job.keepCuttingPlan(planCuts(request.input), request.input);
    afterNextRender(() => this.cuttingPlan()?.focusSummary(), { injector: this.injector });
  }
}
