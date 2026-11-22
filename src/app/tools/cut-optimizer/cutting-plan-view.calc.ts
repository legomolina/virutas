/** How the Cutting Plan is read as text: pure, no Angular, every length in millimetres. */

import type { CutOptimizerInput, StockLayout, UnplacedPart } from './cut-optimizer.calc';

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

/** One stretch of a Stock, in order along it: what the bar of a layout draws. */
export type LayoutSegment =
  | {
      readonly kind: 'part';
      readonly lengthMillimetres: number;
      /** Position of the Part in Cut order, from 1. */
      readonly number: number;
    }
  | { readonly kind: 'trim' | 'kerf' | 'offcut' | 'waste'; readonly lengthMillimetres: number };

/** Shorter than this is a rounding remainder, not material. */
const NOTHING_MILLIMETRES = 1e-9;

/**
 * Reads a layout along its Stock, start to end: the Trim, each Part in Cut order with the Kerf
 * after it, the Offcut or Waste left, and the Trim at the other end. The segments add up to the
 * Stock length, so each one's share of the Stock is its length over that total. A segment with no
 * length (no Trim, no Kerf, nothing left) is left out.
 */
export function layoutSegments(layout: StockLayout, trimMillimetres: number): LayoutSegment[] {
  const segments: LayoutSegment[] = [];
  const add = (kind: Exclude<LayoutSegment['kind'], 'part'>, lengthMillimetres: number): void => {
    if (lengthMillimetres > NOTHING_MILLIMETRES) {
      segments.push({ kind, lengthMillimetres });
    }
  };

  add('trim', trimMillimetres);
  let end = trimMillimetres;
  layout.parts.forEach((part, index) => {
    add('kerf', part.startMillimetres - end);
    segments.push({ kind: 'part', lengthMillimetres: part.lengthMillimetres, number: index + 1 });
    end = part.startMillimetres + part.lengthMillimetres;
  });
  const { kind, lengthMillimetres } = layout.leftover;
  if (kind !== 'none') {
    const remaining = layout.stockLengthMillimetres - trimMillimetres - end;
    add('kerf', remaining - lengthMillimetres);
    add(kind, lengthMillimetres);
  }
  add('trim', trimMillimetres);
  return segments;
}
