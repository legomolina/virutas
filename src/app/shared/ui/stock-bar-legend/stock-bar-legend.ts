import { Component, input } from '@angular/core';
import { Hatch } from '../hatch/hatch';

/** The label of each kind of segment of a `<wt-stock-bar>`, in the current language. */
export interface StockBarLegendLabels {
  readonly part: string;
  readonly kerf: string;
  readonly trim: string;
  readonly offcut: string;
  readonly waste: string;
}

/**
 * Explains the patterns of `<wt-stock-bar>`: a swatch of each kind of segment with its label
 * (design system: Stock bar legend). Like the bars, it is hidden from assistive technology, since
 * the text of each layout says everything the bars show.
 *
 * ```html
 * <wt-stock-bar-legend [labels]="labels" />
 * ```
 */
@Component({
  selector: 'wt-stock-bar-legend',
  imports: [Hatch],
  templateUrl: './stock-bar-legend.html',
  styleUrl: './stock-bar-legend.css',
  host: { 'aria-hidden': 'true' },
})
export class StockBarLegend {
  readonly labels = input.required<StockBarLegendLabels>();
}
