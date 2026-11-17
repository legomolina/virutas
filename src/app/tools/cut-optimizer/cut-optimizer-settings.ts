import { Component, computed, inject } from '@angular/core';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { cutOptimizerDefaults } from '../../core/settings/cut-optimizer-defaults.calc';
import type { CutOptimizerSetting } from '../../core/settings/settings-store';
import { SettingsStore } from '../../core/settings/settings-store';
import { LengthSettingField } from './components/length-setting-field/length-setting-field';

/**
 * The Cut Optimizer's section of the settings page: the Kerf, Trim and minimum Offcut length
 * new jobs start from. The page puts it under the Tool's name, so it renders only the fields.
 */
@Component({
  selector: 'wt-cut-optimizer-settings',
  imports: [LengthSettingField, TranslocoPipe],
  templateUrl: './cut-optimizer-settings.html',
  styleUrl: './cut-optimizer-settings.css',
  providers: [provideTranslocoScope('cut-optimizer')],
})
export class CutOptimizerSettings {
  protected readonly settings = inject(SettingsStore);

  /** What applies under the preferred Unit System when the user has set nothing. */
  protected readonly fallback = computed(() => cutOptimizerDefaults(this.settings.unitSystem()));

  /** The value the user set, or `undefined` while the default applies. */
  protected userValue(setting: CutOptimizerSetting): number | undefined {
    if (!this.settings.cutOptimizerSetByUser()[setting]) {
      return undefined;
    }
    const current = this.settings.cutOptimizerDefaults();
    return {
      kerf: current.kerfMillimetres,
      trim: current.trimMillimetres,
      minimumOffcutLength: current.minimumOffcutLengthMillimetres,
    }[setting];
  }
}
