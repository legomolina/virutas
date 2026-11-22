import { Component, computed, input, model } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type { UnitSystem } from '../../../../shared/measurement/unit-system';
import { SelectField } from '../../../../shared/ui/select-field/select-field';
import { TextField } from '../../../../shared/ui/text-field/text-field';
import type { StrategyId } from '../../cut-optimizer.calc';
import { isStrategyId } from '../../cut-optimizer.calc';
import type { JobSetting, JobSettingsTexts } from '../../job-settings.calc';
import { readJobSettings } from '../../job-settings.calc';

/**
 * The job settings of the Cut Optimizer: the Kerf, Trim and minimum Offcut length of this job.
 * Each shows its default until the woodworker changes it here, which never changes the default.
 * Each value that cannot be used shows a message on its own field.
 */
@Component({
  selector: 'wt-job-settings-section',
  imports: [RouterLink, TranslocoPipe, TextField, SelectField],
  templateUrl: './job-settings-section.html',
  styleUrl: './job-settings-section.css',
})
export class JobSettingsSection {
  /** What each setting shows until it is changed: the default, as text. */
  readonly defaults = input.required<JobSettingsTexts>();

  /** The settings the woodworker changed for this job, as typed. */
  readonly edits = model.required<Partial<JobSettingsTexts>>();

  /** The preferred Unit System, which bare numbers are read in. */
  readonly unitSystem = input.required<UnitSystem>();

  protected readonly texts = computed<JobSettingsTexts>(() => ({
    ...this.defaults(),
    ...this.edits(),
  }));

  protected readonly errors = computed(
    () => readJobSettings(this.texts(), this.unitSystem()).errors,
  );

  /** The Strategy the Cutting Plan is built with. */
  readonly strategy = model.required<StrategyId>();

  protected edit(setting: JobSetting, text: string): void {
    this.edits.update((edits) => ({ ...edits, [setting]: text }));
  }

  protected choose(strategy: string): void {
    if (isStrategyId(strategy)) {
      this.strategy.set(strategy);
    }
  }
}
