import type { ElementRef } from '@angular/core';
import { Component, computed, input, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { ShowLengthOptions } from '../../../../shared/measurement/show-length.calc';
import { defaultDisplayUnit, showLength } from '../../../../shared/measurement/show-length.calc';
import type { UnitSystem } from '../../../../shared/measurement/unit-system';
import { StockBar } from '../../../../shared/ui/stock-bar/stock-bar';
import type { StockBarSegment } from '../../../../shared/ui/stock-bar/stock-bar';
import { StockBarLegend } from '../../../../shared/ui/stock-bar-legend/stock-bar-legend';
import type { CutOptimizerInput, CuttingPlan, StrategyId } from '../../cut-optimizer.calc';
import type { LayoutSegment } from '../../cutting-plan-view.calc';
import {
  groupUnplacedParts,
  layoutSegments,
  longestUsableLength,
} from '../../cutting-plan-view.calc';

/** A segment of a layout as its bar draws it: Parts and the Offcut labelled with their length. */
function barSegment(
  segment: LayoutSegment,
  show: (millimetres: number) => string,
): StockBarSegment {
  const length = segment.lengthMillimetres;
  if (segment.kind === 'part') {
    return { kind: 'part', length, number: segment.number, label: show(length) };
  }
  if (segment.kind === 'offcut') {
    return { kind: 'offcut', length, label: show(length) };
  }
  return { kind: segment.kind, length };
}

/** The translation key of each Strategy's name. */
const STRATEGY_NAMES: Readonly<Record<StrategyId, string>> = {
  'fewest-stock': 'cutOptimizer.jobSettings.strategy.fewestStock',
};

/**
 * The Cutting Plan read as text: a summary with the totals and the settings it was built with,
 * the Unplaced Parts with their reason, then the layouts, identical ones grouped with a count.
 * Each layout also has a bar: a picture of its text, which assistive technology skips. Every length is shown in the preferred Unit System, with `≈` when rounded.
 */
@Component({
  selector: 'wt-cutting-plan',
  imports: [StockBar, StockBarLegend, TranslocoPipe],
  templateUrl: './cutting-plan.html',
  styleUrl: './cutting-plan.css',
})
export class CuttingPlanView {
  private readonly summary = viewChild.required<ElementRef<HTMLElement>>('summary');

  readonly plan = input.required<CuttingPlan>();

  /** What the plan was generated from: its settings are shown with it. */
  readonly input = input.required<CutOptimizerInput>();

  readonly unitSystem = input.required<UnitSystem>();

  readonly lengthOptions = input.required<ShowLengthOptions>();

  protected readonly view = computed(() => {
    const plan = this.plan();
    const { settings } = this.input();
    const unit = defaultDisplayUnit(this.unitSystem());
    const options = this.lengthOptions();
    const show = (millimetres: number): string => showLength(millimetres, unit, options).text;

    return {
      stockTotal: plan.layouts.length,
      stockUsed: plan.totals.stockUsed.map((used) => ({
        count: used.count,
        length: show(used.stockLengthMillimetres),
      })),
      waste: show(plan.totals.wasteMillimetres),
      offcuts: plan.totals.offcutLengthsMillimetres.map(show).join(', '),
      settings: {
        kerf: show(settings.kerfMillimetres),
        trim: show(settings.trimMillimetres),
        minimumOffcutLength: show(settings.minimumOffcutLengthMillimetres),
      },
      strategy: STRATEGY_NAMES[settings.strategy],
      unplacedCount: plan.unplacedParts.length,
      unplaced: groupUnplacedParts(plan.unplacedParts).map((group) => ({
        reason: group.reason,
        parts: group.parts.map((part) => ({
          name: part.name,
          count: part.count,
          length: show(part.lengthMillimetres),
        })),
      })),
      longestUsable: show(longestUsableLength(this.input())),
      groups: plan.groups.map(({ layout, count }) => ({
        count,
        stockLength: show(layout.stockLengthMillimetres),
        parts: layout.parts.map((part) => ({
          name: part.name,
          length: show(part.lengthMillimetres),
        })),
        cuts: layout.cuts,
        trim: settings.trimMillimetres > 0 ? show(settings.trimMillimetres) : undefined,
        leftover: { kind: layout.leftover.kind, length: show(layout.leftover.lengthMillimetres) },
        bar: layoutSegments(layout, settings.trimMillimetres).map((segment) =>
          barSegment(segment, show),
        ),
      })),
    };
  });

  /** Moves focus to the summary, so a keyboard or screen-reader user lands on the result. */
  focusSummary(): void {
    this.summary().nativeElement.focus();
  }
}
