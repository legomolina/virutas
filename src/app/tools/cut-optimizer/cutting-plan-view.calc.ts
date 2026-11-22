/** How the Cutting Plan is read as text: pure, no Angular, every length in millimetres. */

import type { CutOptimizerInput, UnplacedPart } from './cut-optimizer.calc';

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

/** The longest length any Stock entry leaves for Parts once trimmed: what a Part must not exceed. */
export function longestUsableLength(input: CutOptimizerInput): number {
  const longest = Math.max(...input.stock.map((entry) => entry.lengthMillimetres));
  return longest - TRIMMED_ENDS * input.settings.trimMillimetres;
}
