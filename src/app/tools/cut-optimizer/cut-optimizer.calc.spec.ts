import {
  groupLayouts,
  planCuts,
  type CutOptimizerInput,
  type CuttingPlan,
  type StockLayout,
} from './cut-optimizer.calc';

const SETTINGS = { kerfMillimetres: 3, trimMillimetres: 0, minimumOffcutLengthMillimetres: 300 };

function plan(
  overrides: Partial<CutOptimizerInput> & Pick<CutOptimizerInput, 'stock' | 'cutList'>,
): CuttingPlan {
  return planCuts({ settings: SETTINGS, ...overrides });
}

function partLengths(result: CuttingPlan): number[][] {
  return result.layouts.map((layout) => layout.parts.map((part) => part.lengthMillimetres));
}

describe('planCuts', () => {
  describe('Kerf and Cuts', () => {
    it('fits two Parts of 1198.5 mm on one 2400 mm Stock with one Cut and no leftover', () => {
      const result = plan({
        stock: [{ lengthMillimetres: 2400 }],
        cutList: [{ lengthMillimetres: 1198.5, quantity: 2 }],
      });

      expect(result.layouts).toEqual([
        {
          stockLengthMillimetres: 2400,
          parts: [
            { lengthMillimetres: 1198.5, startMillimetres: 0 },
            { lengthMillimetres: 1198.5, startMillimetres: 1201.5 },
          ],
          cuts: 1,
          leftover: { kind: 'none', lengthMillimetres: 0 },
        },
      ]);
      expect(result.unplacedParts).toEqual([]);
    });

    it('makes no Cut for one Part that fills the usable length exactly', () => {
      const result = plan({
        stock: [{ lengthMillimetres: 2400 }],
        cutList: [{ lengthMillimetres: 2400, quantity: 1 }],
      });

      expect(result.layouts[0]?.cuts).toBe(0);
      expect(result.layouts[0]?.leftover).toEqual({ kind: 'none', lengthMillimetres: 0 });
    });

    it('does not add a Kerf before the first Part', () => {
      const result = plan({
        stock: [{ lengthMillimetres: 1000 }],
        cutList: [{ lengthMillimetres: 400, quantity: 1 }],
      });

      expect(result.layouts[0]?.parts).toStrictEqual([
        { lengthMillimetres: 400, startMillimetres: 0 },
      ]);
    });

    it('does not fit a second Part that needs more than the usable length with its Kerf', () => {
      const result = plan({
        stock: [{ lengthMillimetres: 1000 }],
        cutList: [{ lengthMillimetres: 499, quantity: 2 }],
      });

      expect(partLengths(result)).toEqual([[499], [499]]);
    });

    it('fits a second Part that, with its Kerf, ends exactly at the usable length', () => {
      const result = plan({
        stock: [{ lengthMillimetres: 1000 }],
        cutList: [{ lengthMillimetres: 498.5, quantity: 2 }],
      });

      expect(partLengths(result)).toEqual([[498.5, 498.5]]);
    });

    it('tolerates floating-point noise when checking that Parts fit', () => {
      const result = planCuts({
        stock: [{ lengthMillimetres: 0.3 }],
        cutList: [
          { lengthMillimetres: 0.1, quantity: 1 },
          { lengthMillimetres: 0.2, quantity: 1 },
        ],
        settings: { kerfMillimetres: 0, trimMillimetres: 0, minimumOffcutLengthMillimetres: 0 },
      });

      expect(partLengths(result)).toEqual([[0.2, 0.1]]);
      expect(result.layouts[0]?.leftover.kind).toBe('none');
    });
  });

  describe('leftover after the last Part', () => {
    it('counts a leftover smaller than the Kerf as Waste, consumed by the Cut', () => {
      const result = plan({
        stock: [{ lengthMillimetres: 1000 }],
        cutList: [{ lengthMillimetres: 998, quantity: 1 }],
      });

      expect(result.layouts[0]?.leftover).toEqual({ kind: 'waste', lengthMillimetres: 2 });
      expect(result.layouts[0]?.cuts).toBe(1);
    });

    it('counts a leftover equal to the Kerf as Waste, consumed by the Cut', () => {
      const result = plan({
        stock: [{ lengthMillimetres: 1000 }],
        cutList: [{ lengthMillimetres: 997, quantity: 1 }],
      });

      expect(result.layouts[0]?.leftover).toEqual({ kind: 'waste', lengthMillimetres: 3 });
      expect(result.layouts[0]?.cuts).toBe(1);
    });

    it('deducts one Kerf from a leftover greater than the Kerf', () => {
      const result = plan({
        stock: [{ lengthMillimetres: 1000 }],
        cutList: [{ lengthMillimetres: 996, quantity: 1 }],
      });

      expect(result.layouts[0]?.leftover).toEqual({ kind: 'waste', lengthMillimetres: 1 });
      expect(result.layouts[0]?.cuts).toBe(1);
    });

    it('classifies a leftover just below the minimum Offcut length as Waste', () => {
      // 1000 - 698 = 302, minus one Kerf = 299 < 300
      const result = plan({
        stock: [{ lengthMillimetres: 1000 }],
        cutList: [{ lengthMillimetres: 698, quantity: 1 }],
      });

      expect(result.layouts[0]?.leftover).toEqual({ kind: 'waste', lengthMillimetres: 299 });
    });

    it('classifies a leftover exactly at the minimum Offcut length as an Offcut', () => {
      // 1000 - 697 = 303, minus one Kerf = 300
      const result = plan({
        stock: [{ lengthMillimetres: 1000 }],
        cutList: [{ lengthMillimetres: 697, quantity: 1 }],
      });

      expect(result.layouts[0]?.leftover).toEqual({ kind: 'offcut', lengthMillimetres: 300 });
    });

    it('classifies a leftover just above the minimum Offcut length as an Offcut', () => {
      const result = plan({
        stock: [{ lengthMillimetres: 1000 }],
        cutList: [{ lengthMillimetres: 696, quantity: 1 }],
      });

      expect(result.layouts[0]?.leftover).toEqual({ kind: 'offcut', lengthMillimetres: 301 });
    });

    it('counts the Cut after the last Part when there is a leftover', () => {
      const result = plan({
        stock: [{ lengthMillimetres: 2000 }],
        cutList: [{ lengthMillimetres: 500, quantity: 3 }],
      });

      expect(result.layouts[0]?.cuts).toBe(3);
    });

    it('makes the Cut after the last Part even with a zero Kerf', () => {
      const result = planCuts({
        stock: [{ lengthMillimetres: 1000 }],
        cutList: [{ lengthMillimetres: 400, quantity: 1 }],
        settings: { kerfMillimetres: 0, trimMillimetres: 0, minimumOffcutLengthMillimetres: 300 },
      });

      expect(result.layouts[0]?.cuts).toBe(1);
      expect(result.layouts[0]?.leftover).toEqual({ kind: 'offcut', lengthMillimetres: 600 });
    });
  });

  describe('Trim', () => {
    const settings = {
      kerfMillimetres: 3,
      trimMillimetres: 10,
      minimumOffcutLengthMillimetres: 300,
    };

    it('reduces the usable length at both ends: 980 mm fills a 1000 mm Stock with 10 mm Trim', () => {
      const result = planCuts({
        stock: [{ lengthMillimetres: 1000 }],
        cutList: [{ lengthMillimetres: 980, quantity: 1 }],
        settings,
      });

      expect(result.layouts[0]?.parts).toEqual([{ lengthMillimetres: 980, startMillimetres: 10 }]);
      expect(result.layouts[0]?.leftover).toEqual({ kind: 'none', lengthMillimetres: 0 });
    });

    it('starts the next Part after the previous Part and its Kerf, counted from the start of the Stock', () => {
      const result = planCuts({
        stock: [{ lengthMillimetres: 1000 }],
        cutList: [{ lengthMillimetres: 400, quantity: 2 }],
        settings,
      });

      expect(result.layouts[0]?.parts.map((part) => part.startMillimetres)).toEqual([10, 413]);
    });

    it('combines with Kerf: one 400 mm Part on 1000 mm Stock leaves a 577 mm Offcut after one Cut', () => {
      const result = planCuts({
        stock: [{ lengthMillimetres: 1000 }],
        cutList: [{ lengthMillimetres: 400, quantity: 1 }],
        settings,
      });

      expect(result.layouts[0]?.cuts).toBe(1);
      expect(result.layouts[0]?.leftover).toEqual({ kind: 'offcut', lengthMillimetres: 577 });
    });

    it('reports a Part longer than the usable length as too-long', () => {
      const result = planCuts({
        stock: [{ lengthMillimetres: 1000 }],
        cutList: [{ lengthMillimetres: 981, quantity: 1 }],
        settings,
      });

      expect(result.layouts).toEqual([]);
      expect(result.unplacedParts).toStrictEqual([{ lengthMillimetres: 981, reason: 'too-long' }]);
    });
  });

  describe('Unplaced Parts', () => {
    it('plans the Parts that fit and reports the others as too-long', () => {
      const result = plan({
        stock: [{ lengthMillimetres: 1000 }],
        cutList: [
          { name: 'rail', lengthMillimetres: 1500, quantity: 1 },
          { name: 'leg', lengthMillimetres: 400, quantity: 1 },
        ],
      });

      expect(result.layouts).toHaveLength(1);
      expect(result.layouts[0]?.parts).toEqual([
        { name: 'leg', lengthMillimetres: 400, startMillimetres: 0 },
      ]);
      expect(result.unplacedParts).toEqual([
        { name: 'rail', lengthMillimetres: 1500, reason: 'too-long' },
      ]);
    });

    it('reports every unit of a Part with quantity greater than one, in Cut List order', () => {
      const result = plan({
        stock: [{ lengthMillimetres: 1000 }],
        cutList: [
          { lengthMillimetres: 1100, quantity: 1 },
          { lengthMillimetres: 1200, quantity: 2 },
        ],
      });

      expect(result.unplacedParts.map((part) => part.lengthMillimetres)).toEqual([
        1100, 1200, 1200,
      ]);
    });

    it('does not report a Part that fits the longest Stock even if shorter Stock cannot hold it', () => {
      const result = plan({
        stock: [{ lengthMillimetres: 1000 }, { lengthMillimetres: 2000 }],
        cutList: [{ lengthMillimetres: 1500, quantity: 1 }],
      });

      expect(result.unplacedParts).toEqual([]);
      expect(result.layouts[0]?.stockLengthMillimetres).toBe(2000);
    });
  });

  describe('placing Parts', () => {
    it('expands quantities and keeps the name of each Part', () => {
      const result = plan({
        stock: [{ lengthMillimetres: 2400 }],
        cutList: [{ name: 'leg', lengthMillimetres: 700, quantity: 3 }],
      });

      expect(result.layouts[0]?.parts.map((part) => part.name)).toEqual(['leg', 'leg', 'leg']);
    });

    it('places the longest Parts first and fills earlier Stock before opening a new one', () => {
      const result = plan({
        stock: [{ lengthMillimetres: 1000 }],
        cutList: [
          { lengthMillimetres: 400, quantity: 1 },
          { lengthMillimetres: 490, quantity: 1 },
          { lengthMillimetres: 590, quantity: 1 },
          { lengthMillimetres: 500, quantity: 1 },
        ],
      });

      expect(partLengths(result)).toEqual([
        [590, 400],
        [500, 490],
      ]);
    });

    it('keeps Cut List order between Parts of equal length', () => {
      const result = plan({
        stock: [{ lengthMillimetres: 1000 }],
        cutList: [
          { name: 'a', lengthMillimetres: 400, quantity: 1 },
          { name: 'b', lengthMillimetres: 400, quantity: 1 },
        ],
      });

      expect(result.layouts[0]?.parts.map((part) => part.name)).toEqual(['a', 'b']);
    });

    it('opens the shortest Stock entry the Part fits in', () => {
      const result = plan({
        stock: [
          { lengthMillimetres: 3000 },
          { lengthMillimetres: 1000 },
          { lengthMillimetres: 2000 },
        ],
        cutList: [{ lengthMillimetres: 800, quantity: 1 }],
      });

      expect(result.layouts.map((layout) => layout.stockLengthMillimetres)).toEqual([1000]);
    });

    it('does not use Stock whose usable length is below the Part, even if its length alone would fit', () => {
      const result = planCuts({
        stock: [{ lengthMillimetres: 120 }, { lengthMillimetres: 1000 }],
        cutList: [{ lengthMillimetres: 110, quantity: 1 }],
        settings: { kerfMillimetres: 3, trimMillimetres: 10, minimumOffcutLengthMillimetres: 300 },
      });

      expect(result.layouts.map((layout) => layout.stockLengthMillimetres)).toEqual([1000]);
    });

    it('reports every Part as too-long when there is no Stock', () => {
      const result = plan({ stock: [], cutList: [{ lengthMillimetres: 100, quantity: 2 }] });

      expect(result.layouts).toEqual([]);
      expect(result.unplacedParts).toHaveLength(2);
    });

    it('returns an empty plan for an empty Cut List', () => {
      expect(plan({ stock: [{ lengthMillimetres: 1000 }], cutList: [] })).toEqual({
        layouts: [],
        groups: [],
        totals: { stockUsed: [], wasteMillimetres: 0, offcutLengthsMillimetres: [] },
        unplacedParts: [],
      });
    });

    it('returns the same Cutting Plan for the same input', () => {
      const input: CutOptimizerInput = {
        settings: SETTINGS,
        stock: [{ lengthMillimetres: 1000 }],
        cutList: [
          { lengthMillimetres: 300, quantity: 4 },
          { lengthMillimetres: 450, quantity: 2 },
        ],
      };

      const expected = [[450, 450], [300, 300, 300], [300]];

      expect(partLengths(planCuts(input))).toEqual(expected);
      expect(partLengths(planCuts(input))).toEqual(expected);
    });
  });

  describe('groups', () => {
    const job = {
      settings: { kerfMillimetres: 3, trimMillimetres: 10, minimumOffcutLengthMillimetres: 300 },
      stock: [{ lengthMillimetres: 2400 }],
      cutList: [
        { name: 'leg', lengthMillimetres: 1000, quantity: 6 },
        { name: 'rail', lengthMillimetres: 300, quantity: 3 },
      ],
    };

    it('groups three identical Stock cut as leg, leg, rail into one group with a count of 3', () => {
      const { groups } = planCuts(job);

      expect(groups).toHaveLength(1);
      expect(groups[0]?.count).toBe(3);
      expect(groups[0]?.layout.stockLengthMillimetres).toBe(2400);
      expect(groups[0]?.layout.parts.map((part) => part.name)).toEqual(['leg', 'leg', 'rail']);
    });

    it('gives an empty group list when nothing is placed', () => {
      expect(plan({ stock: [], cutList: [{ lengthMillimetres: 10, quantity: 1 }] }).groups).toEqual(
        [],
      );
    });

    function layoutOf(
      stockLengthMillimetres: number,
      parts: [string | undefined, number][],
    ): StockLayout {
      return {
        stockLengthMillimetres,
        parts: parts.map(([name, lengthMillimetres], index) => ({
          ...(name === undefined ? {} : { name }),
          lengthMillimetres,
          startMillimetres: index * 100,
        })),
        cuts: 0,
        leftover: { kind: 'none', lengthMillimetres: 0 },
      };
    }

    it('does not group layouts that differ only in Part order', () => {
      const groups = groupLayouts([
        layoutOf(1000, [
          ['a', 500],
          ['b', 500],
        ]),
        layoutOf(1000, [
          ['b', 500],
          ['a', 500],
        ]),
      ]);

      expect(groups.map((group) => group.count)).toEqual([1, 1]);
    });

    it('does not group layouts that differ only in a Part name', () => {
      const groups = groupLayouts([layoutOf(1000, [['a', 500]]), layoutOf(1000, [['b', 500]])]);

      expect(groups.map((group) => group.count)).toEqual([1, 1]);
    });

    it('does not group a named Part with an unnamed one', () => {
      const groups = groupLayouts([
        layoutOf(1000, [['a', 500]]),
        layoutOf(1000, [[undefined, 500]]),
      ]);

      expect(groups).toHaveLength(2);
    });

    it('does not group layouts that differ only in Stock length', () => {
      const groups = groupLayouts([layoutOf(1000, [['a', 500]]), layoutOf(1200, [['a', 500]])]);

      expect(groups.map((group) => group.count)).toEqual([1, 1]);
    });

    it('does not group layouts that differ only in a Part length', () => {
      const groups = groupLayouts([layoutOf(1000, [['a', 500]]), layoutOf(1000, [['a', 400]])]);

      expect(groups).toHaveLength(2);
    });

    it('keeps groups in order of first appearance and counts non-adjacent repeats', () => {
      const groups = groupLayouts([
        layoutOf(1000, [['a', 500]]),
        layoutOf(1000, [['b', 500]]),
        layoutOf(1000, [['a', 500]]),
      ]);

      expect(groups.map((group) => [group.layout.parts[0]?.name, group.count])).toEqual([
        ['a', 2],
        ['b', 1],
      ]);
    });
  });

  describe('totals', () => {
    it('totals three identical Stock: 3 Stock and 300 mm of Waste (Trim, Kerf and leftover)', () => {
      // Each 2400 mm Stock: Trim 2 x 10, leg 1000, leg 1000, rail 300, 3 Cuts of 3 mm, and a
      // 71 mm leftover (74 mm minus the last Kerf) shorter than 300 mm: 20 + 9 + 71 = 100 mm.
      const { totals } = planCuts({
        settings: { kerfMillimetres: 3, trimMillimetres: 10, minimumOffcutLengthMillimetres: 300 },
        stock: [{ lengthMillimetres: 2400 }],
        cutList: [
          { name: 'leg', lengthMillimetres: 1000, quantity: 6 },
          { name: 'rail', lengthMillimetres: 300, quantity: 3 },
        ],
      });

      expect(totals).toEqual({
        stockUsed: [{ stockLengthMillimetres: 2400, count: 3 }],
        wasteMillimetres: 300,
        offcutLengthsMillimetres: [],
      });
    });

    it('counts Stock per length, shortest first, and adds up the Waste of each', () => {
      // 2300 mm Part on a 2400 mm Stock and 900 mm Part on a 1000 mm Stock: 100 mm of Waste each.
      const { totals } = planCuts({
        settings: { kerfMillimetres: 3, trimMillimetres: 10, minimumOffcutLengthMillimetres: 300 },
        stock: [{ lengthMillimetres: 2400 }, { lengthMillimetres: 1000 }],
        cutList: [
          { lengthMillimetres: 2300, quantity: 1 },
          { lengthMillimetres: 900, quantity: 1 },
        ],
      });

      expect(totals.stockUsed).toEqual([
        { stockLengthMillimetres: 1000, count: 1 },
        { stockLengthMillimetres: 2400, count: 1 },
      ]);
      expect(totals.wasteMillimetres).toBe(200);
    });

    it('lists the Offcut and leaves only the Trim and the Kerf as Waste', () => {
      // 2400 - 1500 Part - 877 Offcut = 23 mm: Trim 2 x 10 plus the Kerf of the one Cut.
      const { totals } = plan({
        settings: { kerfMillimetres: 3, trimMillimetres: 10, minimumOffcutLengthMillimetres: 300 },
        stock: [{ lengthMillimetres: 2400 }],
        cutList: [{ lengthMillimetres: 1500, quantity: 1 }],
      });

      expect(totals.offcutLengthsMillimetres).toEqual([877]);
      expect(totals.wasteMillimetres).toBe(23);
    });

    it('lists the Offcuts in layout order and counts an exact fit as no Waste', () => {
      // 1500 mm on 2000 mm: 497 mm Offcut, 3 mm Kerf. 1000 mm on 1000 mm: exact fit.
      // 600 mm on 1000 mm: 397 mm Offcut, 3 mm Kerf. Waste: 3 + 0 + 3.
      const { totals } = plan({
        stock: [{ lengthMillimetres: 1000 }, { lengthMillimetres: 2000 }],
        cutList: [
          { lengthMillimetres: 600, quantity: 1 },
          { lengthMillimetres: 1500, quantity: 1 },
          { lengthMillimetres: 1000, quantity: 1 },
        ],
      });

      expect(totals.offcutLengthsMillimetres).toEqual([497, 397]);
      expect(totals.wasteMillimetres).toBe(6);
    });
  });
});
