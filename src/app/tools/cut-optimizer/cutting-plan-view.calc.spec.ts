import type { CutOptimizerInput, StockLayout, UnplacedPart } from './cut-optimizer.calc';
import { planCuts } from './cut-optimizer.calc';
import { groupUnplacedParts, layoutSegments, longestUsableLength } from './cutting-plan-view.calc';

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

describe('layoutSegments', () => {
  it('reads a layout with Trim and an Offcut end to end, numbering the Parts in Cut order', () => {
    // 1 800 mm Stock, 5 mm Trim, 3 mm Kerf: shelf 1 100 mm, apron 380 mm, Offcut 304 mm.
    const layout: StockLayout = {
      stockEntryIndex: 0,
      stockLengthMillimetres: 1800,
      parts: [
        { name: 'shelf', lengthMillimetres: 1100, startMillimetres: 5 },
        { name: 'apron', lengthMillimetres: 380, startMillimetres: 1108 },
      ],
      cuts: 2,
      leftover: { kind: 'offcut', lengthMillimetres: 304 },
    };

    expect(layoutSegments(layout, 5)).toEqual([
      { kind: 'trim', lengthMillimetres: 5 },
      { kind: 'part', lengthMillimetres: 1100, number: 1 },
      { kind: 'kerf', lengthMillimetres: 3 },
      { kind: 'part', lengthMillimetres: 380, number: 2 },
      { kind: 'kerf', lengthMillimetres: 3 },
      { kind: 'offcut', lengthMillimetres: 304 },
      { kind: 'trim', lengthMillimetres: 5 },
    ]);
  });

  it('keeps a very short Part and a sliver of Waste as segments of their own', () => {
    // 2 400 mm Stock, 5 mm Trim, 3 mm Kerf: rail 900, spacer 30, rail 900, stile 540, Waste 8.
    const layout: StockLayout = {
      stockEntryIndex: 0,
      stockLengthMillimetres: 2400,
      parts: [
        { name: 'rail', lengthMillimetres: 900, startMillimetres: 5 },
        { name: 'spacer', lengthMillimetres: 30, startMillimetres: 908 },
        { name: 'rail', lengthMillimetres: 900, startMillimetres: 941 },
        { name: 'stile', lengthMillimetres: 540, startMillimetres: 1844 },
      ],
      cuts: 4,
      leftover: { kind: 'waste', lengthMillimetres: 8 },
    };

    expect(layoutSegments(layout, 5)).toEqual([
      { kind: 'trim', lengthMillimetres: 5 },
      { kind: 'part', lengthMillimetres: 900, number: 1 },
      { kind: 'kerf', lengthMillimetres: 3 },
      { kind: 'part', lengthMillimetres: 30, number: 2 },
      { kind: 'kerf', lengthMillimetres: 3 },
      { kind: 'part', lengthMillimetres: 900, number: 3 },
      { kind: 'kerf', lengthMillimetres: 3 },
      { kind: 'part', lengthMillimetres: 540, number: 4 },
      { kind: 'kerf', lengthMillimetres: 3 },
      { kind: 'waste', lengthMillimetres: 8 },
      { kind: 'trim', lengthMillimetres: 5 },
    ]);
  });

  it('has no Trim and no last Cut when the Parts fit the Stock exactly', () => {
    const layout: StockLayout = {
      stockEntryIndex: 0,
      stockLengthMillimetres: 2400,
      parts: [
        { lengthMillimetres: 1198.5, startMillimetres: 0 },
        { lengthMillimetres: 1198.5, startMillimetres: 1201.5 },
      ],
      cuts: 1,
      leftover: { kind: 'none', lengthMillimetres: 0 },
    };

    expect(layoutSegments(layout, 0)).toEqual([
      { kind: 'part', lengthMillimetres: 1198.5, number: 1 },
      { kind: 'kerf', lengthMillimetres: 3 },
      { kind: 'part', lengthMillimetres: 1198.5, number: 2 },
    ]);
  });

  it('has no Kerf when the saw takes none', () => {
    const layout: StockLayout = {
      stockEntryIndex: 0,
      stockLengthMillimetres: 1000,
      parts: [
        { lengthMillimetres: 400, startMillimetres: 0 },
        { lengthMillimetres: 400, startMillimetres: 400 },
      ],
      cuts: 2,
      leftover: { kind: 'offcut', lengthMillimetres: 200 },
    };

    expect(layoutSegments(layout, 0)).toEqual([
      { kind: 'part', lengthMillimetres: 400, number: 1 },
      { kind: 'part', lengthMillimetres: 400, number: 2 },
      { kind: 'offcut', lengthMillimetres: 200 },
    ]);
  });

  it('shows a leftover no longer than a Kerf as Waste, with no Kerf of its own', () => {
    // 1 000 mm Stock, 3 mm Kerf, a 998 mm Part: the last Cut turns the 2 mm left into Waste.
    const layout: StockLayout = {
      stockEntryIndex: 0,
      stockLengthMillimetres: 1000,
      parts: [{ lengthMillimetres: 998, startMillimetres: 0 }],
      cuts: 1,
      leftover: { kind: 'waste', lengthMillimetres: 2 },
    };

    expect(layoutSegments(layout, 0)).toEqual([
      { kind: 'part', lengthMillimetres: 998, number: 1 },
      { kind: 'waste', lengthMillimetres: 2 },
    ]);
  });

  it('adds up to the Stock length in every layout of a plan', () => {
    const input: CutOptimizerInput = {
      stock: [{ lengthMillimetres: 2400 }, { lengthMillimetres: 1800, quantity: 1 }],
      cutList: [
        { name: 'leg', lengthMillimetres: 720, quantity: 4 },
        { name: 'rail', lengthMillimetres: 540, quantity: 4 },
        { name: 'shelf', lengthMillimetres: 1100, quantity: 1 },
        { name: 'apron', lengthMillimetres: 380, quantity: 1 },
        { name: 'spacer', lengthMillimetres: 30.5, quantity: 1 },
      ],
      settings: {
        kerfMillimetres: 3.2,
        trimMillimetres: 5,
        minimumOffcutLengthMillimetres: 300,
        strategy: 'fewest-stock',
      },
    };

    const plan = planCuts(input);

    expect(plan.layouts.length).toBeGreaterThan(1);
    for (const layout of plan.layouts) {
      const total = layoutSegments(layout, 5).reduce(
        (sum, segment) => sum + segment.lengthMillimetres,
        0,
      );
      expect(total).toBeCloseTo(layout.stockLengthMillimetres, 6);
    }
  });
});
