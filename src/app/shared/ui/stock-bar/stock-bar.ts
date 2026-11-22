import { Component, computed, input } from '@angular/core';
import { Hatch } from '../hatch/hatch';

/**
 * One stretch of a `<wt-stock-bar>`, in order along the Stock. `length` is in any unit, the same
 * for every segment: only each one's share of the total matters.
 */
export type StockBarSegment =
  | {
      readonly kind: 'part';
      readonly length: number;
      /** Position in Cut order: the link to the Part in the text next to the bar. */
      readonly number: number;
      /** The length as the text shows it. */
      readonly label: string;
    }
  | {
      readonly kind: 'offcut';
      readonly length: number;
      /** The length as the text shows it, under the word for an Offcut (`offcutTerm`). */
      readonly label: string;
    }
  | { readonly kind: 'trim' | 'kerf' | 'waste'; readonly length: number };

/** What one segment draws: its labels are left out when it does not show them. */
interface DrawnSegment {
  readonly kind: StockBarSegment['kind'];
  readonly length: number;
  readonly number?: number;
  readonly label?: string;
}

/** The number of a Part too short to hold it, and where its Part's middle is along the bar. */
interface Marker {
  readonly number: number;
  readonly offsetPercent: number;
}

/** A Part narrower than this share of the Stock cannot hold its number. */
const SHORT_PART = 0.02;

const PERCENT = 100;

/** A marker points at the middle of its Part: half-way along it. */
const HALF = 0.5;

/**
 * A Stock drawn as a bar of its Parts, Kerf, Trim, Offcut and Waste, each sized in proportion to
 * its length (design system: Stock bar). Parts are numbered in Cut order; the number of a Part
 * under 2 % of the Stock moves under the bar. A label hides when its segment is too narrow for it, and
 * Kerf, Trim and Waste keep a minimum width so they stay visible.
 *
 * The bar is a picture of text shown next to it, so it is hidden from assistive technology and
 * must never carry information that text lacks. Colour is never the only difference between
 * kinds: each has its own pattern and outline.
 *
 * ```html
 * <wt-stock-bar [segments]="segments" offcutTerm="Offcut" />
 * ```
 */
@Component({
  selector: 'wt-stock-bar',
  imports: [Hatch],
  templateUrl: './stock-bar.html',
  styleUrl: './stock-bar.css',
  host: { 'aria-hidden': 'true' },
})
export class StockBar {
  readonly segments = input.required<readonly StockBarSegment[]>();

  /** The word for an Offcut, in the current language, shown on an Offcut wide enough for it. */
  readonly offcutTerm = input.required<string>();

  protected readonly view = computed(() => {
    const segments = this.segments();
    const total = segments.reduce((sum, segment) => sum + segment.length, 0);
    const drawn: DrawnSegment[] = [];
    const markers: Marker[] = [];
    let start = 0;
    for (const segment of segments) {
      const { kind, length } = segment;
      if (segment.kind === 'part' && length / total < SHORT_PART) {
        markers.push({
          number: segment.number,
          offsetPercent: ((start + length * HALF) / total) * PERCENT,
        });
        drawn.push({ kind, length });
      } else if (segment.kind === 'part') {
        drawn.push({ kind, length, number: segment.number, label: segment.label });
      } else if (segment.kind === 'offcut') {
        drawn.push({ kind, length, label: segment.label });
      } else {
        drawn.push({ kind, length });
      }
      start += length;
    }
    return { drawn, markers };
  });
}
