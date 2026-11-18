import { readPositiveLength } from '../../shared/measurement/read-positive-length.calc';
import type { UnitSystem } from '../../shared/measurement/unit-system';
import type { CutListEntry } from './cut-optimizer.calc';
import type { Identified } from './typed-entry.calc';
import { nextEntryId, readQuantity } from './typed-entry.calc';

/** A Cut List entry exactly as typed. */
export interface CutListEntryTexts {
  readonly name: string;
  readonly length: string;
  readonly quantity: string;
}

/** A Cut List entry as typed on the page, with an id that stays the same while the entry exists. */
export interface TypedCutListEntry extends CutListEntryTexts, Identified {}

/** A new, empty Cut List entry with an id after the highest in `entries`, so no id is reused. */
export function emptyCutListEntry(entries: readonly TypedCutListEntry[]): TypedCutListEntry {
  return { id: nextEntryId(entries), name: '', length: '', quantity: '' };
}

export interface CutListEntryErrors {
  readonly length?: 'unreadable' | 'not-positive';
  readonly quantity?: 'not-positive-integer';
}

export interface CutListEntryReading {
  readonly errors: CutListEntryErrors;
  /** Set only when the entry can be used. */
  readonly entry?: CutListEntry;
}

/**
 * Reads a typed Cut List entry. The name is optional; the length and the quantity are needed, but
 * an empty one is not an error. A value that cannot be used is reported on its own field, whatever
 * the others hold.
 */
export function readCutListEntry(
  texts: CutListEntryTexts,
  unitSystem: UnitSystem,
): CutListEntryReading {
  const length = readPositiveLength(texts.length, unitSystem);
  const quantity = readQuantity(texts.quantity);

  const errors: CutListEntryErrors = {
    ...(length.state === 'error' ? { length: length.error } : {}),
    ...(quantity.state === 'error' ? { quantity: 'not-positive-integer' } : {}),
  };

  if (length.state !== 'ok' || quantity.state !== 'ok') {
    return { errors };
  }
  const name = texts.name.trim();
  return {
    errors,
    entry: {
      ...(name === '' ? {} : { name }),
      lengthMillimetres: length.millimetres,
      quantity: quantity.quantity,
    },
  };
}
