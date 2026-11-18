import type { ReadLengthError } from '../../shared/measurement/read-length.calc';
import { readLength } from '../../shared/measurement/read-length.calc';
import type { UnitSystem } from '../../shared/measurement/unit-system';
import type { JobSettings } from './cut-optimizer.calc';

/** A job setting of the Cut Optimizer, each a length of zero or more. */
export type JobSetting = 'kerf' | 'trim' | 'minimumOffcutLength';

/** The job settings exactly as typed. */
export type JobSettingsTexts = Readonly<Record<JobSetting, string>>;

/** What is wrong with each job setting that cannot be used. */
export type JobSettingsErrors = Readonly<Partial<Record<JobSetting, ReadLengthError>>>;

export interface JobSettingsReading {
  readonly errors: JobSettingsErrors;
  /** Set only when every setting can be used. */
  readonly settings?: Omit<JobSettings, 'strategy'>;
}

/**
 * Reads the typed job settings. Each must be a length of zero or more; an empty one is an error
 * too, since the job has no other value to fall back on. A value that cannot be used is reported
 * on its own setting, whatever the others hold.
 */
export function readJobSettings(
  texts: JobSettingsTexts,
  unitSystem: UnitSystem,
): JobSettingsReading {
  const kerf = readLength(texts.kerf, unitSystem);
  const trim = readLength(texts.trim, unitSystem);
  const minimumOffcutLength = readLength(texts.minimumOffcutLength, unitSystem);

  const errors: JobSettingsErrors = {
    ...(kerf.ok ? {} : { kerf: kerf.error }),
    ...(trim.ok ? {} : { trim: trim.error }),
    ...(minimumOffcutLength.ok ? {} : { minimumOffcutLength: minimumOffcutLength.error }),
  };

  if (!kerf.ok || !trim.ok || !minimumOffcutLength.ok) {
    return { errors };
  }
  return {
    errors,
    settings: {
      kerfMillimetres: kerf.millimetres,
      trimMillimetres: trim.millimetres,
      minimumOffcutLengthMillimetres: minimumOffcutLength.millimetres,
    },
  };
}
