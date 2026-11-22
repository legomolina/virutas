import type { LayoutGroup, StockLayout, UnplacedPart } from './cut-optimizer.calc';
import { expandGroups, groupUnplacedParts, longestUsableLength } from './cutting-plan-view.calc';

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

  it('is zero when the Trim takes the whole Stock', () => {
    expect(
      longestUsableLength({
        stock: [{ lengthMillimetres: 100 }],
        cutList: [],
        settings: {
          kerfMillimetres: 3,
          trimMillimetres: 60,
          minimumOffcutLengthMillimetres: 300,
          strategy: 'fewest-stock',
        },
      }),
    ).toBe(0);
  });
});

describe('expandGroups', () => {
  const legs: StockLayout = {
    stockEntryIndex: 0,
    stockLengthMillimetres: 2400,
    parts: [
      { name: 'leg', lengthMillimetres: 720, startMillimetres: 0 },
      { name: 'leg', lengthMillimetres: 720, startMillimetres: 723 },
      { name: 'rail', lengthMillimetres: 540, startMillimetres: 1446 },
    ],
    cuts: 3,
    leftover: { kind: 'waste', lengthMillimetres: 405 },
  };
  const shelf: StockLayout = {
    stockEntryIndex: 1,
    stockLengthMillimetres: 1800,
    parts: [{ name: 'shelf', lengthMillimetres: 1100, startMillimetres: 0 }],
    cuts: 1,
    leftover: { kind: 'offcut', lengthMillimetres: 697 },
  };

  it('has no Stock when the plan has no layouts', () => {
    expect(expandGroups([])).toEqual([]);
  });

  it('repeats each group once per Stock, numbering every Stock in the plan, group by group', () => {
    const groups: LayoutGroup[] = [
      { layout: legs, count: 3 },
      { layout: shelf, count: 1 },
    ];

    expect(expandGroups(groups)).toEqual([
      { layout: legs, position: 1 },
      { layout: legs, position: 2 },
      { layout: legs, position: 3 },
      { layout: shelf, position: 4 },
    ]);
  });
});
