import { readPositiveLength } from '../../shared/measurement/read-positive-length.calc';
import type { UnitSystem } from '../../shared/measurement/unit-system';

/** A Stock entry exactly as typed. */
export interface StockEntryTexts {
  readonly length: string;
  readonly quantity: string;
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

/** Digits only: no sign, decimal separator or exponent. */
const DIGITS = /^\d+$/u;

/**
 * Reads a typed quantity: `{}` when it is empty (as many as needed), `{ quantity }` for a positive
 * integer, `undefined` for anything else.
 */
function readQuantity(text: string): { readonly quantity?: number } | undefined {
  const trimmed = text.trim();
  if (trimmed === '') {
    return {};
  }
  const quantity = Number(trimmed);
  return DIGITS.test(trimmed) && quantity > 0 && Number.isSafeInteger(quantity)
    ? { quantity }
    : undefined;
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
    ...(quantity === undefined ? { quantity: 'not-positive-integer' } : {}),
  };

  if (length.state !== 'ok' || quantity === undefined) {
    return { errors };
  }
  return { errors, entry: { lengthMillimetres: length.millimetres, ...quantity } };
}
