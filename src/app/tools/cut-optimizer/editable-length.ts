import type { ShowLengthOptions } from '../../shared/measurement/show-length.calc';
import {
  APPROXIMATE_MARK,
  defaultDisplayUnit,
  showLength,
} from '../../shared/measurement/show-length.calc';
import type { UnitSystem } from '../../shared/measurement/unit-system';

/**
 * A length as text to put in a field the woodworker edits, in the default unit of their Unit
 * System. It leaves out the `≈` mark, which would not read back.
 */
export function editableLength(
  millimetres: number,
  unitSystem: UnitSystem,
  options: ShowLengthOptions,
): string {
  return showLength(millimetres, defaultDisplayUnit(unitSystem), options).text.replace(
    APPROXIMATE_MARK,
    '',
  );
}
