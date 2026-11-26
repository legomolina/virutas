import {
  chosenSettings,
  isImperialPrecision,
  isSettingLength,
  isUnitSystem,
  settingsDocument,
} from './settings-document.calc';

describe('settingsDocument', () => {
  it('holds only the version when nothing was chosen', () => {
    expect(settingsDocument({})).toStrictEqual({ version: 1 });
  });

  it('holds every chosen Setting, the Cut Optimizer defaults grouped together', () => {
    expect(
      settingsDocument({
        unitSystem: 'imperial',
        imperialPrecision: 32,
        language: 'es',
        kerfMillimetres: 2.5,
        trimMillimetres: 10,
        minimumOffcutLengthMillimetres: 500,
      }),
    ).toEqual({
      version: 1,
      unitSystem: 'imperial',
      imperialPrecision: 32,
      language: 'es',
      cutOptimizer: {
        kerfMillimetres: 2.5,
        trimMillimetres: 10,
        minimumOffcutLengthMillimetres: 500,
      },
    });
  });

  it('leaves out each value that was not chosen', () => {
    expect(settingsDocument({ imperialPrecision: 16, kerfMillimetres: 0 })).toStrictEqual({
      version: 1,
      imperialPrecision: 16,
      cutOptimizer: { kerfMillimetres: 0 },
    });
    expect(
      settingsDocument({ unitSystem: 'metric', language: 'en', trimMillimetres: 5 }),
    ).toStrictEqual({
      version: 1,
      unitSystem: 'metric',
      language: 'en',
      cutOptimizer: { trimMillimetres: 5 },
    });
    expect(settingsDocument({ minimumOffcutLengthMillimetres: 250 })).toStrictEqual({
      version: 1,
      cutOptimizer: { minimumOffcutLengthMillimetres: 250 },
    });
  });
});

describe('chosenSettings', () => {
  it('reads back every Setting of a saved document', () => {
    expect(
      chosenSettings({
        version: 1,
        unitSystem: 'metric',
        imperialPrecision: 64,
        language: 'en',
        cutOptimizer: {
          kerfMillimetres: 3.2,
          trimMillimetres: 0,
          minimumOffcutLengthMillimetres: 250,
        },
      }),
    ).toEqual({
      unitSystem: 'metric',
      imperialPrecision: 64,
      language: 'en',
      kerfMillimetres: 3.2,
      trimMillimetres: 0,
      minimumOffcutLengthMillimetres: 250,
    });
  });

  it('reads nothing from a document with only the version', () => {
    expect(chosenSettings({ version: 1 })).toEqual({});
  });

  it.each([
    ['a missing version', { unitSystem: 'imperial' }],
    ['an unknown version', { version: 2, unitSystem: 'imperial' }],
    ['a version written as text', { version: '1', unitSystem: 'imperial' }],
    ['nothing saved', undefined],
    ['null', null],
    ['a number', 1],
    ['text', 'imperial'],
    ['a list', [1, 'imperial']],
  ])('ignores %s', (_description, saved) => {
    expect(chosenSettings(saved)).toEqual({});
  });

  it('drops an invalid field and keeps the others', () => {
    expect(
      chosenSettings({
        version: 1,
        unitSystem: 'furlongs',
        imperialPrecision: 12,
        language: 'fr',
        cutOptimizer: {
          kerfMillimetres: -1,
          trimMillimetres: '10',
          minimumOffcutLengthMillimetres: 500,
        },
      }),
    ).toStrictEqual({ minimumOffcutLengthMillimetres: 500 });
    expect(
      chosenSettings({
        version: 1,
        imperialPrecision: 8,
        cutOptimizer: { kerfMillimetres: 2, minimumOffcutLengthMillimetres: -5 },
      }),
    ).toStrictEqual({ imperialPrecision: 8, kerfMillimetres: 2 });
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['a list', [2]],
    ['a number', 5],
    ['text', 'kerf'],
  ])('keeps the global Settings when the Cut Optimizer group is %s', (_description, group) => {
    expect(chosenSettings({ version: 1, language: 'es', cutOptimizer: group })).toStrictEqual({
      language: 'es',
    });
  });

  it('round-trips a document it built', () => {
    const chosen = { unitSystem: 'imperial', imperialPrecision: 8, trimMillimetres: 6 } as const;

    expect(chosenSettings(settingsDocument(chosen))).toEqual(chosen);
  });
});

describe('isUnitSystem', () => {
  it.each(['metric', 'imperial'])('accepts %s', (value) => {
    expect(isUnitSystem(value)).toBe(true);
  });

  it.each(['Metric', '', undefined, 1])('rejects %s', (value) => {
    expect(isUnitSystem(value)).toBe(false);
  });
});

describe('isImperialPrecision', () => {
  it.each([8, 16, 32, 64])('accepts %i', (value) => {
    expect(isImperialPrecision(value)).toBe(true);
  });

  it.each([0, -16, 4, 12, 128, 16.5, Number.NaN, '16'])('rejects %s', (value) => {
    expect(isImperialPrecision(value)).toBe(false);
  });
});

describe('isSettingLength', () => {
  it.each([0, 2.5, 3000])('accepts %s millimetres', (value) => {
    expect(isSettingLength(value)).toBe(true);
  });

  it.each([-0.1, -1, Number.NaN, Number.POSITIVE_INFINITY, '3', null])('rejects %s', (value) => {
    expect(isSettingLength(value)).toBe(false);
  });
});
