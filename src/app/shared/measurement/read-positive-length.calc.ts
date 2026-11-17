import { readLength } from './read-length.calc';
import type { UnitSystem } from './unit-system';

export type PositiveLengthReading =
  | { readonly state: 'empty' }
  | { readonly state: 'error'; readonly error: 'unreadable' | 'not-positive' }
  | { readonly state: 'ok'; readonly millimetres: number };

/**
 * Reads a length that must be greater than zero, such as a Thickness or a Stock length. An empty
 * text is not an error: it is reported as `empty`, so the caller decides whether it is missing.
 */
export function readPositiveLength(text: string, unitSystem: UnitSystem): PositiveLengthReading {
  const reading = readLength(text, unitSystem);
  if (!reading.ok) {
    return reading.error === 'empty'
      ? { state: 'empty' }
      : { state: 'error', error: reading.error === 'negative' ? 'not-positive' : 'unreadable' };
  }
  return reading.millimetres > 0
    ? { state: 'ok', millimetres: reading.millimetres }
    : { state: 'error', error: 'not-positive' };
}
