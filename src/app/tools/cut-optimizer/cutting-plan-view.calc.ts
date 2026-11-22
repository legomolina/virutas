/** How the Cutting Plan is read as text: pure, no Angular, every length in millimetres. */

import type {
  CutOptimizerInput,
  LayoutGroup,
  StockLayout,
  UnplacedPart,
} from './cut-optimizer.calc';

export interface UnplacedPartCount {
  readonly name?: string;
  readonly lengthMillimetres: number;
  readonly count: number;
}

/** The Unplaced Parts that share a reason, identical Parts counted once. */
export interface UnplacedGroup {
  readonly reason: UnplacedPart['reason'];
  readonly parts: readonly UnplacedPartCount[];
}

/**
 * Groups the Unplaced Parts by reason, then counts identical Parts (same name and length), each in
 * order of first appearance.
 */
export function groupUnplacedParts(unplaced: readonly UnplacedPart[]): UnplacedGroup[] {
  const groups = new Map<UnplacedPart['reason'], Map<string, UnplacedPartCount>>();
  for (const { reason, ...part } of unplaced) {
    const parts = groups.get(reason) ?? new Map<string, UnplacedPartCount>();
    groups.set(reason, parts);
    const key = JSON.stringify([part.name ?? null, part.lengthMillimetres]);
    parts.set(key, { ...part, count: (parts.get(key)?.count ?? 0) + 1 });
  }
  return [...groups].map(([reason, parts]) => ({ reason, parts: [...parts.values()] }));
}

/** Trim is taken from both ends of every Stock. */
const TRIMMED_ENDS = 2;

/**
 * The longest length any Stock entry leaves for Parts once trimmed: what a Part must not exceed.
 * Zero when the Trim takes the whole Stock.
 */
export function longestUsableLength(input: CutOptimizerInput): number {
  const longest = Math.max(...input.stock.map((entry) => entry.lengthMillimetres));
  return Math.max(0, longest - TRIMMED_ENDS * input.settings.trimMillimetres);
}

/** One Stock of the plan, shown on its own. */
export interface NumberedLayout {
  readonly layout: StockLayout;
  /** Counted from 1 over every Stock in the plan. */
  readonly position: number;
}

/**
 * Expands each group of identical layouts into its individual Stock, so they can be ticked off one by
 * one: the groups keep their order and each Stock is numbered across the whole plan.
 */
export function expandGroups(groups: readonly LayoutGroup[]): NumberedLayout[] {
  return groups
    .flatMap(({ layout, count }) => Array.from({ length: count }, () => layout))
    .map((layout, index) => ({ layout, position: index + 1 }));
}
