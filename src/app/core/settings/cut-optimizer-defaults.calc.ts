import type { UnitSystem } from '../../shared/measurement/unit-system';

/** The Cut Optimizer settings a job starts from, every length in millimetres. */
export interface CutOptimizerDefaults {
  readonly kerfMillimetres: number;
  readonly trimMillimetres: number;
  readonly minimumOffcutLengthMillimetres: number;
}

const METRIC: CutOptimizerDefaults = {
  kerfMillimetres: 3,
  trimMillimetres: 0,
  minimumOffcutLengthMillimetres: 300,
};

/** Kerf 1/8" and minimum Offcut length 12", at 25.4 mm to the inch. */
const IMPERIAL: CutOptimizerDefaults = {
  kerfMillimetres: 3.175,
  trimMillimetres: 0,
  minimumOffcutLengthMillimetres: 304.8,
};

/** The Kerf, Trim and minimum Offcut length used until the woodworker sets one. */
export function cutOptimizerDefaults(unitSystem: UnitSystem): CutOptimizerDefaults {
  return unitSystem === 'metric' ? METRIC : IMPERIAL;
}
