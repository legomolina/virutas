import {
  groupLayouts,
  planCuts,
  type CutOptimizerInput,
  type CuttingPlan,
  type JobSettings,
  type StockLayout,
} from './cut-optimizer.calc';

const SETTINGS: JobSettings = {
  kerfMillimetres: 3,
  trimMillimetres: 0,
  minimumOffcutLengthMillimetres: 300,
  strategy: 'fewest-stock',
};

function plan(
  overrides: Partial<CutOptimizerInput> & Pick<CutOptimizerInput, 'stock' | 'cutList'>,
): CuttingPlan {
  return planCuts({ settings: SETTINGS, ...overrides });
}

/** Each layout as `<Stock length>: <Part lengths>`. */
function describeLayouts(result: CuttingPlan): string[] {
  return result.layouts.map(
    (layout) =>
      `${layout.stockLengthMillimetres}: ${layout.parts.map((part) => part.lengthMillimetres).join(' + ')}`,
  );
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
          stockEntryIndex: 0,
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
        settings: { ...SETTINGS, kerfMillimetres: 0, minimumOffcutLengthMillimetres: 0 },
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
        settings: { ...SETTINGS, kerfMillimetres: 0 },
      });

      expect(result.layouts[0]?.cuts).toBe(1);
      expect(result.layouts[0]?.leftover).toEqual({ kind: 'offcut', lengthMillimetres: 600 });
    });
  });

  describe('Trim', () => {
    const settings: JobSettings = { ...SETTINGS, trimMillimetres: 10 };

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
        settings: { ...SETTINGS, trimMillimetres: 10 },
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

  describe('Stock quantities', () => {
    it('uses Stock entries of the same length limited first, then in the order they were entered', () => {
      const result = plan({
        stock: [
          { lengthMillimetres: 1000 },
          { lengthMillimetres: 1000, quantity: 1 },
          { lengthMillimetres: 1000, quantity: 1 },
          { lengthMillimetres: 1000 },
        ],
        cutList: [{ lengthMillimetres: 600, quantity: 4 }],
      });

      expect(result.layouts.map((layout) => layout.stockEntryIndex)).toEqual([1, 2, 0, 0]);
    });

    it('uses limited Stock before unlimited Stock of the same length', () => {
      const result = plan({
        stock: [{ lengthMillimetres: 1000 }, { lengthMillimetres: 1000, quantity: 1 }],
        cutList: [{ lengthMillimetres: 600, quantity: 2 }],
      });

      expect(result.layouts.map((layout) => layout.stockEntryIndex)).toEqual([1, 0]);
      expect(result.unplacedParts).toEqual([]);
    });

    it('uses a limited Stock entry no more times than its quantity', () => {
      const result = plan({
        stock: [{ lengthMillimetres: 1000, quantity: 1 }],
        cutList: [{ lengthMillimetres: 400, quantity: 3 }],
      });

      expect(partLengths(result)).toEqual([[400, 400]]);
      expect(result.unplacedParts).toStrictEqual([
        { lengthMillimetres: 400, reason: 'insufficient-stock' },
      ]);
    });
  });

  describe('mixing limited and unlimited Stock', () => {
    it('uses a longer Stock on hand rather than buying a shorter one', () => {
      const result = plan({
        stock: [{ lengthMillimetres: 2400, quantity: 1 }, { lengthMillimetres: 1200 }],
        cutList: [{ lengthMillimetres: 1000, quantity: 1 }],
      });

      expect(describeLayouts(result)).toEqual(['2400: 1000']);
    });

    it('uses two Stock on hand rather than buying one', () => {
      // One bought 2400 mm Stock holds both Parts, but the two 1000 mm on hand hold one each.
      const result = plan({
        stock: [{ lengthMillimetres: 1000, quantity: 2 }, { lengthMillimetres: 2400 }],
        cutList: [{ lengthMillimetres: 900, quantity: 2 }],
      });

      expect(describeLayouts(result)).toEqual(['1000: 900', '1000: 900']);
    });

    it('buys the least Stock length when it must buy the same number of Stock', () => {
      // Buying one 2400 mm for both Parts, or cutting 900 from the 1000 on hand and buying a 1200.
      const result = planCuts({
        settings: { ...SETTINGS, kerfMillimetres: 0 },
        stock: [
          { lengthMillimetres: 1000, quantity: 1 },
          { lengthMillimetres: 1200 },
          { lengthMillimetres: 2400 },
        ],
        cutList: [
          { lengthMillimetres: 1100, quantity: 1 },
          { lengthMillimetres: 900, quantity: 1 },
        ],
      });

      expect(describeLayouts(result)).toEqual(['1000: 900', '1200: 1100']);
    });

    it('uses fewer Stock rather than Stock on hand when it buys the same either way', () => {
      // A 2500 mm Stock is bought in both plans: alone for 800 + 800 + 500, or for 500 with the two
      // 800s on the 1000s on hand. Fewer Stock in total decides.
      const result = planCuts({
        settings: { ...SETTINGS, kerfMillimetres: 0 },
        stock: [{ lengthMillimetres: 2500 }, { lengthMillimetres: 1000, quantity: 2 }],
        cutList: [
          { lengthMillimetres: 500, quantity: 1 },
          { lengthMillimetres: 800, quantity: 2 },
        ],
      });

      expect(describeLayouts(result)).toEqual(['2500: 800 + 800 + 500']);
    });

    it('between Stock on hand that both fit, uses the shorter and keeps the longer whole', () => {
      const result = plan({
        stock: [
          { lengthMillimetres: 2400, quantity: 1 },
          { lengthMillimetres: 1200, quantity: 1 },
        ],
        cutList: [{ lengthMillimetres: 1000, quantity: 1 }],
      });

      expect(describeLayouts(result)).toEqual(['1200: 1000']);
    });

    it('falls back to an unlimited entry once the limited Stock runs out', () => {
      const result = plan({
        stock: [{ lengthMillimetres: 1000, quantity: 1 }, { lengthMillimetres: 2000 }],
        cutList: [{ lengthMillimetres: 900, quantity: 3 }],
      });

      expect(result.layouts.map((layout) => layout.stockLengthMillimetres)).toEqual([1000, 2000]);
      expect(result.unplacedParts).toEqual([]);
    });

    it('reports insufficient-stock only for the Parts the limited Stock cannot hold, planning the rest', () => {
      const result = plan({
        stock: [{ lengthMillimetres: 2000, quantity: 1 }, { lengthMillimetres: 1000 }],
        cutList: [
          { name: 'rail', lengthMillimetres: 1500, quantity: 2 },
          { name: 'leg', lengthMillimetres: 700, quantity: 2 },
        ],
      });

      expect(partLengths(result)).toEqual([[1500], [700], [700]]);
      expect(result.unplacedParts).toStrictEqual([
        { name: 'rail', lengthMillimetres: 1500, reason: 'insufficient-stock' },
      ]);
    });

    it('reports too-long, not insufficient-stock, for a Part no Stock entry can hold', () => {
      const result = plan({
        stock: [{ lengthMillimetres: 1000, quantity: 1 }],
        cutList: [{ lengthMillimetres: 1200, quantity: 1 }],
      });

      expect(result.unplacedParts).toStrictEqual([{ lengthMillimetres: 1200, reason: 'too-long' }]);
    });
  });

  describe('the fewest Stock Strategy', () => {
    const noKerf: JobSettings = {
      ...SETTINGS,
      kerfMillimetres: 0,
      minimumOffcutLengthMillimetres: 200,
    };

    it('uses as few Stock as the Parts need, even when first-fit decreasing opens one more', () => {
      // 4400 mm of Parts need two Stock; the only way is 1400 + 300 + 300 = 2000 and 1200 + 1200 on
      // the single 2500. First-fit decreasing puts 1400 on the 2500 and opens two 2000 for the 1200s.
      const result = planCuts({
        settings: noKerf,
        stock: [{ lengthMillimetres: 2000 }, { lengthMillimetres: 2500, quantity: 1 }],
        cutList: [
          { lengthMillimetres: 1200, quantity: 2 },
          { lengthMillimetres: 300, quantity: 2 },
          { lengthMillimetres: 1400, quantity: 1 },
        ],
      });

      expect(describeLayouts(result)).toEqual(['2000: 1400 + 300 + 300', '2500: 1200 + 1200']);
    });

    it('never uses one more Stock to save total Stock length', () => {
      // 11 100 mm of Parts: three 3000 mm Stock are too short, four are enough.
      const result = plan({
        stock: [
          { lengthMillimetres: 3000 },
          { lengthMillimetres: 1000 },
          { lengthMillimetres: 2000 },
        ],
        cutList: [
          { lengthMillimetres: 500, quantity: 1 },
          { lengthMillimetres: 900, quantity: 2 },
          { lengthMillimetres: 1100, quantity: 1 },
          { lengthMillimetres: 800, quantity: 2 },
          { lengthMillimetres: 1100, quantity: 2 },
          { lengthMillimetres: 1100, quantity: 1 },
          { lengthMillimetres: 1400, quantity: 2 },
        ],
      });

      expect(result.layouts).toHaveLength(4);
      expect(result.unplacedParts).toEqual([]);
    });

    it('prefers one long Stock over two short ones with a smaller total length', () => {
      // Two 900 mm Parts: 2 × 1000 = 2000 mm, or 1 × 2500 mm.
      const result = plan({
        stock: [{ lengthMillimetres: 1000 }, { lengthMillimetres: 2500 }],
        cutList: [{ lengthMillimetres: 900, quantity: 2 }],
      });

      expect(partLengths(result)).toEqual([[900, 900]]);
      expect(result.layouts[0]?.stockLengthMillimetres).toBe(2500);
    });

    it('between equally few Stock, uses the least total Stock length', () => {
      // Two 900 mm Parts and one Kerf need 1803 mm: one 2000 mm Stock, not 3000 mm.
      const result = plan({
        stock: [
          { lengthMillimetres: 1000 },
          { lengthMillimetres: 3000 },
          { lengthMillimetres: 2000 },
        ],
        cutList: [{ lengthMillimetres: 900, quantity: 2 }],
      });

      expect(result.layouts.map((layout) => layout.stockLengthMillimetres)).toEqual([2000]);
    });

    it('uses a second Stock on hand rather than buying a shorter one', () => {
      // 3400 mm of Parts need two Stock: the two 3000 mm on hand, or one of them and a bought 1000.
      const result = planCuts({
        settings: noKerf,
        stock: [{ lengthMillimetres: 1000 }, { lengthMillimetres: 3000, quantity: 2 }],
        cutList: [
          { lengthMillimetres: 1400, quantity: 2 },
          { lengthMillimetres: 600, quantity: 1 },
        ],
      });

      expect(describeLayouts(result)).toEqual(['3000: 1400 + 1400', '3000: 600']);
    });

    it('between equally few Stock of the same total length, prefers a longer Offcut', () => {
      // [600, 300] + [500, 200] leaves 100 and 300; [600] + [500, 300, 200] leaves 400 and nothing.
      const result = planCuts({
        settings: { ...SETTINGS, kerfMillimetres: 0, minimumOffcutLengthMillimetres: 100 },
        stock: [{ lengthMillimetres: 1000 }],
        cutList: [
          { lengthMillimetres: 600, quantity: 1 },
          { lengthMillimetres: 500, quantity: 1 },
          { lengthMillimetres: 300, quantity: 1 },
          { lengthMillimetres: 200, quantity: 1 },
        ],
      });

      expect(partLengths(result)).toEqual([[600], [500, 300, 200]]);
      expect(result.layouts.map((layout) => layout.leftover)).toEqual([
        { kind: 'offcut', lengthMillimetres: 400 },
        { kind: 'none', lengthMillimetres: 0 },
      ]);
    });

    it('compares the longest Offcuts first', () => {
      // [1400 + 1400] and [1100] leave 200 and 1900; [1400 + 1100] and [1400] leave 500 and 1600.
      const result = planCuts({
        settings: { ...noKerf, minimumOffcutLengthMillimetres: 100 },
        stock: [{ lengthMillimetres: 3000 }],
        cutList: [
          { lengthMillimetres: 1100, quantity: 1 },
          { lengthMillimetres: 1400, quantity: 2 },
        ],
      });

      expect(describeLayouts(result)).toEqual(['3000: 1400 + 1400', '3000: 1100']);
    });

    it('keeps moving Parts until no move lengthens the Offcuts', () => {
      // Two 1800 mm Stock at best (2400 mm of Parts). 900 + 900 fills one exactly, so 400 + 200 on
      // the other leaves the longest possible Offcut: 1200 mm.
      const result = planCuts({
        settings: noKerf,
        stock: [{ lengthMillimetres: 2000 }, { lengthMillimetres: 1800 }],
        cutList: [
          { lengthMillimetres: 400, quantity: 1 },
          { lengthMillimetres: 900, quantity: 2 },
          { lengthMillimetres: 200, quantity: 1 },
        ],
      });

      expect(describeLayouts(result)).toEqual(['1800: 900 + 900', '1800: 400 + 200']);
    });

    it('compares the next-longest Offcuts when the longest are equal', () => {
      // Five 1500 mm Stock at least. The 500 alone leaves the longest Offcut, 1000 mm; then the 100
      // joins the two 700s (leaving 400 and 400 after the 1100s) rather than an 1100 (300 and 100).
      const result = planCuts({
        settings: { ...noKerf, minimumOffcutLengthMillimetres: 100 },
        stock: [{ lengthMillimetres: 1500 }],
        cutList: [
          { lengthMillimetres: 700, quantity: 2 },
          { lengthMillimetres: 1100, quantity: 2 },
          { lengthMillimetres: 600, quantity: 1 },
          { lengthMillimetres: 100, quantity: 1 },
          { lengthMillimetres: 900, quantity: 1 },
          { lengthMillimetres: 500, quantity: 1 },
        ],
      });

      expect(describeLayouts(result)).toEqual([
        '1500: 1100',
        '1500: 1100',
        '1500: 900 + 600',
        '1500: 700 + 700 + 100',
        '1500: 500',
      ]);
    });

    it('prefers the longest Offcut over a shorter Offcut or none', () => {
      // Three Stock (3400 mm of Parts), at best 2000 + 1000 + 1000. Two Parts share the 2000:
      // 800 + 800 leaves a 400 mm Offcut; 900 + 900 leaves 200 mm, and 900 + 800 leaves 300 mm with
      // 100 and 200 mm of Waste on the 1000s.
      const result = planCuts({
        settings: { ...noKerf, minimumOffcutLengthMillimetres: 300 },
        stock: [{ lengthMillimetres: 1000 }, { lengthMillimetres: 2000, quantity: 1 }],
        cutList: [
          { lengthMillimetres: 900, quantity: 2 },
          { lengthMillimetres: 800, quantity: 2 },
        ],
      });

      expect(describeLayouts(result)).toEqual(['1000: 900', '1000: 900', '2000: 800 + 800']);
      expect(result.layouts[2]?.leftover).toEqual({ kind: 'offcut', lengthMillimetres: 400 });
    });

    it('moves a Part to a shorter Stock, then keeps the plan with the longest Offcut', () => {
      // Two 2500 mm Stock: 1200 + 1200 and 500 + 300 leave a 1700 mm Offcut, the longest possible.
      const result = planCuts({
        settings: noKerf,
        stock: [{ lengthMillimetres: 2500, quantity: 2 }, { lengthMillimetres: 3000 }],
        cutList: [
          { lengthMillimetres: 500, quantity: 1 },
          { lengthMillimetres: 1200, quantity: 2 },
          { lengthMillimetres: 300, quantity: 1 },
        ],
      });

      expect(describeLayouts(result)).toEqual(['2500: 1200 + 1200', '2500: 500 + 300']);
    });

    it('does not move Parts only to lengthen Waste', () => {
      // First-fit decreasing on 2500 mm Stock: 1200 + 1100 | 1100 + 1100 + 200 | 600 + 600 + 500,
      // the last moved to a 2000. All three leftovers are Waste, so no move improves the plan.
      const result = plan({
        stock: [{ lengthMillimetres: 2500 }, { lengthMillimetres: 2000 }],
        cutList: [
          { lengthMillimetres: 1200, quantity: 1 },
          { lengthMillimetres: 1100, quantity: 1 },
          { lengthMillimetres: 500, quantity: 1 },
          { lengthMillimetres: 200, quantity: 1 },
          { lengthMillimetres: 600, quantity: 2 },
          { lengthMillimetres: 1100, quantity: 2 },
        ],
      });

      expect(describeLayouts(result)).toEqual([
        '2500: 1200 + 1100',
        '2500: 1100 + 1100 + 200',
        '2000: 600 + 600 + 500',
      ]);
    });

    it('builds the same Cutting Plan twice from the same mixed input', () => {
      const input: CutOptimizerInput = {
        settings: { ...SETTINGS, trimMillimetres: 5 },
        stock: [
          { lengthMillimetres: 2400 },
          { lengthMillimetres: 1800, quantity: 2 },
          { lengthMillimetres: 900, quantity: 3 },
        ],
        cutList: [
          { name: 'leg', lengthMillimetres: 720, quantity: 4 },
          { name: 'rail', lengthMillimetres: 560, quantity: 6 },
          { name: 'shelf', lengthMillimetres: 1100, quantity: 2 },
        ],
      };

      const before = structuredClone(input);
      const first = planCuts(input);

      expect(planCuts(input)).toStrictEqual(first);
      expect(input).toStrictEqual(before);
    });
  });

  describe('groups', () => {
    const job = {
      settings: { ...SETTINGS, trimMillimetres: 10 },
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
        stockEntryIndex: 0,
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
        settings: { ...SETTINGS, trimMillimetres: 10 },
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
        settings: { ...SETTINGS, trimMillimetres: 10 },
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
        settings: { ...SETTINGS, trimMillimetres: 10 },
        stock: [{ lengthMillimetres: 2400 }],
        cutList: [{ lengthMillimetres: 1500, quantity: 1 }],
      });

      expect(totals.offcutLengthsMillimetres).toEqual([877]);
      expect(totals.wasteMillimetres).toBe(23);
    });

    it('lists the Offcuts in layout order and counts an exact fit as no Waste', () => {
      // 1500 mm on the one 2000 mm on hand: 497 mm Offcut, 3 mm Kerf. 1000 mm on 1000 mm: exact
      // fit. 600 mm on 1000 mm: 397 mm Offcut, 3 mm Kerf. Waste: 3 + 0 + 3.
      const { totals } = plan({
        stock: [{ lengthMillimetres: 1000 }, { lengthMillimetres: 2000, quantity: 1 }],
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
