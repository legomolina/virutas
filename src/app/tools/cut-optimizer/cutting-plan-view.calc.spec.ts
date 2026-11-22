import type { UnplacedPart } from './cut-optimizer.calc';
import { groupUnplacedParts, longestUsableLength } from './cutting-plan-view.calc';

describe('groupUnplacedParts', () => {
  it('has no groups when every Part is placed', () => {
    expect(groupUnplacedParts([])).toEqual([]);
  });

  it('groups by reason, then counts identical Parts, in order of first appearance', () => {
    const unplaced: UnplacedPart[] = [
      { name: 'shelf', lengthMillimetres: 1100, reason: 'insufficient-stock' },
      { name: 'top', lengthMillimetres: 2500, reason: 'too-long' },
      { name: 'shelf', lengthMillimetres: 1100, reason: 'insufficient-stock' },
      { name: 'apron', lengthMillimetres: 380, reason: 'insufficient-stock' },
      { lengthMillimetres: 380, reason: 'insufficient-stock' },
      { name: 'top', lengthMillimetres: 2500, reason: 'too-long' },
    ];

    expect(groupUnplacedParts(unplaced)).toEqual([
      {
        reason: 'insufficient-stock',
        parts: [
          { name: 'shelf', lengthMillimetres: 1100, count: 2 },
          { name: 'apron', lengthMillimetres: 380, count: 1 },
          { lengthMillimetres: 380, count: 1 },
        ],
      },
      { reason: 'too-long', parts: [{ name: 'top', lengthMillimetres: 2500, count: 2 }] },
    ]);
  });

  it('keeps Parts with the same name but different lengths apart', () => {
    expect(
      groupUnplacedParts([
        { name: 'rail', lengthMillimetres: 540, reason: 'too-long' },
        { name: 'rail', lengthMillimetres: 600, reason: 'too-long' },
      ]),
    ).toEqual([
      {
        reason: 'too-long',
        parts: [
          { name: 'rail', lengthMillimetres: 540, count: 1 },
          { name: 'rail', lengthMillimetres: 600, count: 1 },
        ],
      },
    ]);
  });
});

describe('longestUsableLength', () => {
  it('is the longest Stock length less the Trim at both ends', () => {
    expect(
      longestUsableLength({
        stock: [{ lengthMillimetres: 1800 }, { lengthMillimetres: 2400, quantity: 1 }],
        cutList: [],
        settings: {
          kerfMillimetres: 3,
          trimMillimetres: 5,
          minimumOffcutLengthMillimetres: 300,
          strategy: 'fewest-stock',
        },
      }),
    ).toBe(2390);
  });
});
