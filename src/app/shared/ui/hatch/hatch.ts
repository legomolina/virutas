import { Component, input } from '@angular/core';

/** `single`: lines one way, as on Trim. `cross`: lines both ways, as on Waste. */
export type HatchPattern = 'single' | 'cross';

/** Counts hatches, so each one's pattern has an id no other hatch on the page uses. */
let hatchCount = 0;

/**
 * Diagonal 1 px lines, 5 px apart, filling their box in the text colour (design system: Stock
 * bar). Drawn as an inline SVG pattern, not a CSS gradient background, so it prints as crisp
 * lines at any scale, even with the browser's "background graphics" off. It is decoration, so it
 * is hidden from assistive technology.
 *
 * ```html
 * <wt-hatch pattern="cross" />
 * ```
 */
@Component({
  selector: 'wt-hatch',
  templateUrl: './hatch.html',
  styleUrl: './hatch.css',
  host: { '[attr.pattern]': 'pattern()', 'aria-hidden': 'true' },
})
export class Hatch {
  readonly pattern = input.required<HatchPattern>();

  protected readonly patternId = `wt-hatch-${++hatchCount}`;
}
