import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { SettingsStore } from '../../../../core/settings/settings-store';
import { readLength } from '../../../../shared/measurement/read-length.calc';
import {
  APPROXIMATE_MARK,
  defaultDisplayUnit,
  showLength,
} from '../../../../shared/measurement/show-length.calc';
import { TextField } from '../../../../shared/ui/text-field/text-field';

/**
 * A length setting: a field the woodworker types a length in, kept apart from the store so
 * half-typed text never reaches it. A readable length is emitted in millimetres; an empty
 * field asks for the default again; anything else shows a message and emits nothing.
 */
@Component({
  selector: 'wt-length-setting-field',
  imports: [TextField, TranslocoPipe],
  templateUrl: './length-setting-field.html',
})
export class LengthSettingField {
  private readonly settings = inject(SettingsStore);

  readonly name = input.required<string>();

  readonly label = input.required<string>();

  /** The length the user set, in millimetres; unset while the default applies. */
  readonly millimetres = input<number>();

  /** The default for the preferred Unit System, in millimetres, told in the hint. */
  readonly defaultMillimetres = input.required<number>();

  /** A readable length the user typed, in millimetres. */
  readonly lengthChange = output<number>();

  /** The user emptied the field: the default applies again. */
  readonly defaultRequested = output();

  /** Shown again in the new Unit System, precision or language, so a bare number never changes meaning. */
  protected readonly text = linkedSignal<unknown, string>({
    source: () => [
      this.settings.unitSystem(),
      this.settings.imperialPrecision(),
      this.settings.language(),
    ],
    computation: () => {
      const millimetres = this.millimetres();
      return millimetres === undefined ? '' : this.show(millimetres);
    },
  });

  protected readonly defaultText = computed(() => this.show(this.defaultMillimetres()));

  protected readonly problem = computed(() => {
    const result = readLength(this.text(), this.settings.unitSystem());
    return result.ok || result.error === 'empty' ? undefined : result.error;
  });

  protected edit(text: string): void {
    this.text.set(text);
    const result = readLength(text, this.settings.unitSystem());
    if (result.ok) {
      this.lengthChange.emit(result.millimetres);
    } else if (result.error === 'empty') {
      this.defaultRequested.emit();
    }
  }

  /** Without the `≈` mark, which would not read back. */
  private show(millimetres: number): string {
    const unitSystem = this.settings.unitSystem();
    return showLength(millimetres, defaultDisplayUnit(unitSystem), {
      precision: this.settings.imperialPrecision(),
      language: this.settings.language(),
    }).text.replace(APPROXIMATE_MARK, '');
  }
}
