import { Component, input, model } from '@angular/core';
import type { FormCheckboxControl } from '@angular/forms/signals';

/**
 * An on/off choice (design system: Checkbox): a native checkbox with its visible
 * label beside it, so it is named by that label, toggles with Space, and the
 * whole label is a target at least `control-height` tall. Write the label as
 * what checking it does, in sentence case.
 *
 * ```html
 * <wt-checkbox label="Show every Stock" [(checked)]="everyStock" />
 * ```
 */
@Component({
  selector: 'wt-checkbox',
  templateUrl: './checkbox.html',
  styleUrl: './checkbox.css',
})
export class Checkbox implements FormCheckboxControl {
  readonly label = input.required<string>();

  readonly checked = model(false);
}
