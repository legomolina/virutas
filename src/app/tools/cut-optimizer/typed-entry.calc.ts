/** What Stock entries and Cut List entries, as typed on the page, have in common. */

/** An entry with an id that stays the same while the entry exists. */
export interface Identified {
  readonly id: number;
}

export type QuantityReading =
  | { readonly state: 'empty' }
  | { readonly state: 'error' }
  | { readonly state: 'ok'; readonly quantity: number };

/** Digits only: no sign, decimal separator or exponent. */
const DIGITS = /^\d+$/u;

/**
 * Reads a typed quantity, which must be a positive integer. An empty text is not an error: it is
 * reported as `empty`, so the caller decides what it means.
 */
export function readQuantity(text: string): QuantityReading {
  const trimmed = text.trim();
  if (trimmed === '') {
    return { state: 'empty' };
  }
  const quantity = Number(trimmed);
  return DIGITS.test(trimmed) && quantity > 0 && Number.isSafeInteger(quantity)
    ? { state: 'ok', quantity }
    : { state: 'error' };
}

/** The id for a new entry: after the highest in `entries`, so no id is reused. */
export function nextEntryId(entries: readonly Identified[]): number {
  return Math.max(0, ...entries.map((entry) => entry.id)) + 1;
}

/**
 * The entry that should take focus once the entry `id` is removed: the one that takes its place,
 * or the one before it when it was the last; `undefined` when none is left.
 */
export function entryAfterRemoving<T extends Identified>(
  entries: readonly T[],
  id: number,
): T | undefined {
  const index = entries.findIndex((entry) => entry.id === id);
  const remaining = entries.filter((entry) => entry.id !== id);
  return remaining.at(Math.min(index, remaining.length - 1));
}
