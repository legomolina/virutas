import { readPositiveLength } from '../../shared/measurement/read-positive-length.calc';
import type { UnitSystem } from '../../shared/measurement/unit-system';
import type { Identified } from './typed-entry.calc';
import { nextEntryId, readQuantity } from './typed-entry.calc';

/** A Stock entry exactly as typed. */
export interface StockEntryTexts {
  readonly length: string;
  readonly quantity: string;
}

/** A Stock entry as typed on the page, with an id that stays the same while the entry exists. */
export interface TypedStockEntry extends StockEntryTexts, Identified {}

/** A new, empty Stock entry with an id after the highest in `entries`, so no id is reused. */
export function emptyStockEntry(entries: readonly TypedStockEntry[]): TypedStockEntry {
  return { id: nextEntryId(entries), length: '', quantity: '' };
}

export interface StockEntryErrors {
  readonly length?: 'unreadable' | 'not-positive';
  readonly quantity?: 'not-positive-integer';
}

export interface StockEntryReading {
  readonly errors: StockEntryErrors;
  /** Set only when the entry can be used. */
  readonly entry?: {
    readonly lengthMillimetres: number;
    /** How many of this Stock there are; absent means as many as needed. */
    readonly quantity?: number;
  };
}

/**
 * Reads a typed Stock entry. An empty quantity means as many as needed. A value that cannot be
 * used is reported on its own field, whatever the other holds.
 */
export function readStockEntry(texts: StockEntryTexts, unitSystem: UnitSystem): StockEntryReading {
  const length = readPositiveLength(texts.length, unitSystem);
  const quantity = readQuantity(texts.quantity);

  const errors: StockEntryErrors = {
    ...(length.state === 'error' ? { length: length.error } : {}),
    ...(quantity.state === 'error' ? { quantity: 'not-positive-integer' } : {}),
  };

  if (length.state !== 'ok' || quantity.state === 'error') {
    return { errors };
  }
  return {
    errors,
    entry: {
      lengthMillimetres: length.millimetres,
      ...(quantity.state === 'ok' ? { quantity: quantity.quantity } : {}),
    },
  };
}
