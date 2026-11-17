import { readStockEntry } from './stock-entry.calc';

describe('readStockEntry', () => {
  it('reads a length with an empty quantity as unlimited Stock', () => {
    expect(readStockEntry({ length: '2400 mm', quantity: '' }, 'metric')).toStrictEqual({
      errors: {},
      entry: { lengthMillimetres: 2400 },
    });
  });

  it('reads a bare length in the preferred Unit System', () => {
    expect(readStockEntry({ length: '10', quantity: '' }, 'imperial')).toStrictEqual({
      errors: {},
      entry: { lengthMillimetres: 254 },
    });
  });

  it('reads a quantity as how many of that Stock there are', () => {
    expect(readStockEntry({ length: '1800', quantity: ' 3 ' }, 'metric')).toStrictEqual({
      errors: {},
      entry: { lengthMillimetres: 1800, quantity: 3 },
    });
  });

  it('reads a quantity of several digits', () => {
    expect(readStockEntry({ length: '2400', quantity: '12' }, 'metric')).toStrictEqual({
      errors: {},
      entry: { lengthMillimetres: 2400, quantity: 12 },
    });
  });

  it.each([
    '0',
    '00',
    '-2',
    '1.5',
    '2,5',
    '3.0',
    '1e2',
    'two',
    '3 boards',
    '+3',
    '9007199254740993',
  ])('flags the quantity %j as not a positive integer, on the quantity only', (quantity) => {
    expect(readStockEntry({ length: '2400', quantity }, 'metric')).toStrictEqual({
      errors: { quantity: 'not-positive-integer' },
    });
  });

  it.each([
    ['24oo mm', 'unreadable'],
    ['0', 'not-positive'],
    ['-2400', 'not-positive'],
  ] as const)('flags the length %j as %s, on the length only', (length, error) => {
    expect(readStockEntry({ length, quantity: '2' }, 'metric')).toStrictEqual({
      errors: { length: error },
    });
  });

  it('flags the length and the quantity each on its own field', () => {
    expect(readStockEntry({ length: 'abc', quantity: '0' }, 'metric')).toStrictEqual({
      errors: { length: 'unreadable', quantity: 'not-positive-integer' },
    });
  });

  it('has no entry and no error while the length is empty', () => {
    expect(readStockEntry({ length: ' ', quantity: '2' }, 'metric')).toStrictEqual({ errors: {} });
  });
});
