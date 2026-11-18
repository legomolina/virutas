import { readJobSettings } from './job-settings.calc';

describe('readJobSettings', () => {
  it('reads the Kerf, Trim and minimum Offcut length in millimetres', () => {
    expect(
      readJobSettings({ kerf: '3 mm', trim: '5 mm', minimumOffcutLength: '300 mm' }, 'metric'),
    ).toStrictEqual({
      errors: {},
      settings: { kerfMillimetres: 3, trimMillimetres: 5, minimumOffcutLengthMillimetres: 300 },
    });
  });

  it('accepts zero for every setting', () => {
    expect(
      readJobSettings({ kerf: '0', trim: '0 mm', minimumOffcutLength: '0"' }, 'metric'),
    ).toStrictEqual({
      errors: {},
      settings: { kerfMillimetres: 0, trimMillimetres: 0, minimumOffcutLengthMillimetres: 0 },
    });
  });

  it('reads bare numbers in the preferred Unit System', () => {
    expect(
      readJobSettings({ kerf: '1/8', trim: '1/2', minimumOffcutLength: '10' }, 'imperial'),
    ).toStrictEqual({
      errors: {},
      settings: {
        kerfMillimetres: 3.175,
        trimMillimetres: 12.7,
        minimumOffcutLengthMillimetres: 254,
      },
    });
  });

  it.each([
    ['-1 mm', 'negative'],
    ['3oo', 'unreadable'],
    ['', 'empty'],
    ['   ', 'empty'],
  ] as const)('flags the Kerf %j as %s, on the Kerf only', (kerf, error) => {
    expect(
      readJobSettings({ kerf, trim: '5', minimumOffcutLength: '300' }, 'metric'),
    ).toStrictEqual({ errors: { kerf: error } });
  });

  it('flags the Trim on the Trim only', () => {
    expect(
      readJobSettings({ kerf: '3', trim: '-5', minimumOffcutLength: '300' }, 'metric'),
    ).toStrictEqual({ errors: { trim: 'negative' } });
  });

  it('flags the minimum Offcut length on the minimum Offcut length only', () => {
    expect(
      readJobSettings({ kerf: '3', trim: '5', minimumOffcutLength: 'abc' }, 'metric'),
    ).toStrictEqual({ errors: { minimumOffcutLength: 'unreadable' } });
  });

  it('flags every setting that cannot be used at once', () => {
    expect(
      readJobSettings({ kerf: '-3', trim: '', minimumOffcutLength: 'one foot' }, 'metric'),
    ).toStrictEqual({
      errors: { kerf: 'negative', trim: 'empty', minimumOffcutLength: 'unreadable' },
    });
  });
});
