import { entryAfterRemoving, nextEntryId, readQuantity } from './typed-entry.calc';

describe('readQuantity', () => {
  it('reads an empty text as empty', () => {
    expect(readQuantity('')).toStrictEqual({ state: 'empty' });
  });

  it('reads blanks as empty', () => {
    expect(readQuantity('  ')).toStrictEqual({ state: 'empty' });
  });

  it.each([
    ['1', 1],
    [' 3 ', 3],
    ['12', 12],
    ['007', 7],
  ])('reads %j as the quantity %d', (text, quantity) => {
    expect(readQuantity(text)).toStrictEqual({ state: 'ok', quantity });
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
  ])('flags %j as not a positive integer', (text) => {
    expect(readQuantity(text)).toStrictEqual({ state: 'error' });
  });
});

describe('nextEntryId', () => {
  it('is 1 when there is no entry', () => {
    expect(nextEntryId([])).toBe(1);
  });

  it('is after the highest id in use, so no id is reused', () => {
    expect(nextEntryId([{ id: 4 }, { id: 2 }])).toBe(5);
  });
});

describe('entryAfterRemoving', () => {
  const entries = [{ id: 1 }, { id: 2 }, { id: 3 }];

  it('is the entry that takes the place of the removed one', () => {
    expect(entryAfterRemoving(entries, 2)).toStrictEqual({ id: 3 });
  });

  it('is the entry before when the last one is removed', () => {
    expect(entryAfterRemoving(entries, 3)).toStrictEqual({ id: 2 });
  });

  it('is the next entry when the first one is removed', () => {
    expect(entryAfterRemoving(entries, 1)).toStrictEqual({ id: 2 });
  });

  it('is none when the only entry is removed', () => {
    expect(entryAfterRemoving([{ id: 7 }], 7)).toBeUndefined();
  });
});
