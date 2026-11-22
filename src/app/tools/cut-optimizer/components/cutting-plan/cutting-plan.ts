import type { ElementRef } from '@angular/core';
import { Component, computed, input, signal, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { ShowLengthOptions } from '../../../../shared/measurement/show-length.calc';
import { defaultDisplayUnit, showLength } from '../../../../shared/measurement/show-length.calc';
import type { UnitSystem } from '../../../../shared/measurement/unit-system';
import type { CutOptimizerInput, CuttingPlan, StrategyId } from '../../cut-optimizer.calc';
import type { StockLayout } from '../../cut-optimizer.calc';
import {
  expandGroups,
  groupUnplacedParts,
  longestUsableLength,
} from '../../cutting-plan-view.calc';

/** A layout read as text, every length already shown in the preferred Unit System. */
interface LayoutText {
  readonly parts: readonly { readonly name?: string; readonly length: string }[];
  readonly cuts: number;
  /** Absent when there is no Trim. */
  readonly trim?: string;
  readonly leftover: { readonly kind: StockLayout['leftover']['kind']; readonly length: string };
}

/** A layout as listed: a group of identical Stock, or one Stock when every Stock is shown. */
interface ListedLayout extends LayoutText {
  readonly stockLength: string;
  /** How many identical Stock it stands for: 1 when every Stock is shown. */
  readonly count: number;
  /** Its place among every Stock in the plan, counted from 1; absent while grouped. */
  readonly position?: number;
}

/** The translation key of each Strategy's name. */
const STRATEGY_NAMES: Readonly<Record<StrategyId, string>> = {
  'fewest-stock': 'cutOptimizer.jobSettings.strategy.fewestStock',
};

/**
 * The Cutting Plan read as text: a summary with the totals and the settings it was built with,
 * the Unplaced Parts with their reason, then the layouts, identical ones grouped with a count until
 * "Show every Stock" expands them into individual Stock to tick off one by one.
 * Every length is shown in the preferred Unit System, with `≈` when rounded.
 */
@Component({
  selector: 'wt-cutting-plan',
  imports: [TranslocoPipe],
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

  /** Whether each group of identical layouts is expanded into its individual Stock. */
  protected readonly everyStock = signal(false);

  protected readonly view = computed(() => {
    const plan = this.plan();
    const { settings } = this.input();
    const unit = defaultDisplayUnit(this.unitSystem());
    const options = this.lengthOptions();
    const show = (millimetres: number): string => showLength(millimetres, unit, options).text;
    const describeLayout = (layout: StockLayout): LayoutText => ({
      parts: layout.parts.map((part) => ({
        name: part.name,
        length: show(part.lengthMillimetres),
      })),
      cuts: layout.cuts,
      trim: settings.trimMillimetres > 0 ? show(settings.trimMillimetres) : undefined,
      leftover: { kind: layout.leftover.kind, length: show(layout.leftover.lengthMillimetres) },
    });

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
      /** Grouped: each with its `count`. Every Stock: one each, with its `position` in the plan. */
      layouts: this.everyStock()
        ? expandGroups(plan.groups).map(({ layout, position }): ListedLayout => ({
            count: 1,
            position,
            stockLength: show(layout.stockLengthMillimetres),
            ...describeLayout(layout),
          }))
        : plan.groups.map(({ layout, count }): ListedLayout => ({
            count,
            stockLength: show(layout.stockLengthMillimetres),
            ...describeLayout(layout),
          })),
    };
  });

  /** Moves focus to the summary, so a keyboard or screen-reader user lands on the result. */
  focusSummary(): void {
    this.summary().nativeElement.focus();
  }
}
