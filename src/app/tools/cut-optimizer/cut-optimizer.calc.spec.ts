import { planCuts, type CutOptimizerInput, type CuttingPlan } from './cut-optimizer.calc';

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

    it('returns an empty plan for an empty Cut List', () => {
      expect(plan({ stock: [{ lengthMillimetres: 1000 }], cutList: [] })).toEqual({
        layouts: [],
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

      expect(planCuts(input)).toEqual(planCuts(input));
    });
  });
});
