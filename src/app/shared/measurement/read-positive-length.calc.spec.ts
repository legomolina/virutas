import { readPositiveLength } from './read-positive-length.calc';

describe('readPositiveLength', () => {
  it('reads a length greater than zero in millimetres', () => {
    expect(readPositiveLength('2400 mm', 'imperial')).toEqual({ state: 'ok', millimetres: 2400 });
  });

  it('reads a bare number in the preferred Unit System', () => {
    expect(readPositiveLength('1', 'imperial')).toEqual({ state: 'ok', millimetres: 25.4 });
  });

  it('reports an empty text as empty, not as an error', () => {
    expect(readPositiveLength('  ', 'metric')).toEqual({ state: 'empty' });
  });

  it.each([
    ['abc', 'unreadable'],
    ['-', 'unreadable'],
    ['0', 'not-positive'],
    ['0 mm', 'not-positive'],
    ['-5', 'not-positive'],
    ['-3 1/2"', 'not-positive'],
  ] as const)('rejects %j as %s', (text, error) => {
    expect(readPositiveLength(text, 'metric')).toEqual({ state: 'error', error });
  });
});
