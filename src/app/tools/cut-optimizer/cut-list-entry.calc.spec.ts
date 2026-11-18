import { emptyCutListEntry, readCutListEntry } from './cut-list-entry.calc';

describe('readCutListEntry', () => {
  it('reads a named Part with its length and quantity', () => {
    expect(
      readCutListEntry({ name: 'leg', length: '720 mm', quantity: '6' }, 'metric'),
    ).toStrictEqual({
      errors: {},
      entry: { name: 'leg', lengthMillimetres: 720, quantity: 6 },
    });
  });

  it('reads a Part without a name', () => {
    expect(readCutListEntry({ name: '', length: '540', quantity: '4' }, 'metric')).toStrictEqual({
      errors: {},
      entry: { lengthMillimetres: 540, quantity: 4 },
    });
  });

  it('takes a name of blanks as no name', () => {
    expect(readCutListEntry({ name: '   ', length: '540', quantity: '4' }, 'metric')).toStrictEqual(
      { errors: {}, entry: { lengthMillimetres: 540, quantity: 4 } },
    );
  });

  it('trims the blanks around a name', () => {
    expect(
      readCutListEntry({ name: '  top rail ', length: '540', quantity: '1' }, 'metric'),
    ).toStrictEqual({
      errors: {},
      entry: { name: 'top rail', lengthMillimetres: 540, quantity: 1 },
    });
  });

  it('reads a bare length in the preferred Unit System', () => {
    expect(readCutListEntry({ name: '', length: '10', quantity: '1' }, 'imperial')).toStrictEqual({
      errors: {},
      entry: { lengthMillimetres: 254, quantity: 1 },
    });
  });

  it.each(['0', '-2', '1.5', 'two'])(
    'flags the quantity %j as not a positive integer, on the quantity only',
    (quantity) => {
      expect(readCutListEntry({ name: 'leg', length: '720', quantity }, 'metric')).toStrictEqual({
        errors: { quantity: 'not-positive-integer' },
      });
    },
  );

  it.each([
    ['72o mm', 'unreadable'],
    ['0', 'not-positive'],
    ['-720', 'not-positive'],
  ] as const)('flags the length %j as %s, on the length only', (length, error) => {
    expect(readCutListEntry({ name: 'leg', length, quantity: '2' }, 'metric')).toStrictEqual({
      errors: { length: error },
    });
  });

  it('flags the length and the quantity each on its own field', () => {
    expect(readCutListEntry({ name: '', length: 'abc', quantity: '0' }, 'metric')).toStrictEqual({
      errors: { length: 'unreadable', quantity: 'not-positive-integer' },
    });
  });

  it('flags a length that cannot be read while the quantity is still empty', () => {
    expect(readCutListEntry({ name: '', length: 'abc', quantity: '' }, 'metric')).toStrictEqual({
      errors: { length: 'unreadable' },
    });
  });

  it('flags a quantity that is not a positive integer while the length is still empty', () => {
    expect(readCutListEntry({ name: '', length: '', quantity: '0' }, 'metric')).toStrictEqual({
      errors: { quantity: 'not-positive-integer' },
    });
  });

  it('has no entry and no error while the length is empty', () => {
    expect(readCutListEntry({ name: 'leg', length: ' ', quantity: '2' }, 'metric')).toStrictEqual({
      errors: {},
    });
  });

  it('has no entry and no error while the quantity is empty', () => {
    expect(readCutListEntry({ name: 'leg', length: '720', quantity: ' ' }, 'metric')).toStrictEqual(
      { errors: {} },
    );
  });
});

describe('emptyCutListEntry', () => {
  it('is the first entry, with id 1, when there is none', () => {
    expect(emptyCutListEntry([])).toStrictEqual({ id: 1, name: '', length: '', quantity: '' });
  });

  it('takes an id after the highest in use, so no id is reused', () => {
    const entries = [
      { id: 4, name: 'leg', length: '720', quantity: '6' },
      { id: 2, name: '', length: '540', quantity: '4' },
    ];

    expect(emptyCutListEntry(entries)).toStrictEqual({
      id: 5,
      name: '',
      length: '',
      quantity: '',
    });
  });
});
