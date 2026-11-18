// Wall-clock budget for planCuts. It lives outside `*.calc.spec.ts` on purpose:
// Stryker instruments the code it mutates and runs those specs several times
// slower, so a timing check there fails at random (#124). Here it runs through
// `ng test` against the uninstrumented code.
import { planCuts } from './cut-optimizer.calc';

describe('planCuts performance', () => {
  it('plans about 100 Parts with the fewest Stock Strategy well under a second', () => {
    const cutList = Array.from({ length: 20 }, (_, index) => ({
      lengthMillimetres: 150 + index * 47,
      quantity: 5,
    }));

    const started = performance.now();
    const result = planCuts({
      settings: {
        kerfMillimetres: 3,
        trimMillimetres: 0,
        minimumOffcutLengthMillimetres: 300,
        strategy: 'fewest-stock',
      },
      stock: [
        { lengthMillimetres: 2400 },
        { lengthMillimetres: 3000 },
        { lengthMillimetres: 1200, quantity: 4 },
      ],
      cutList,
    });
    const elapsed = performance.now() - started;

    expect(result.unplacedParts).toEqual([]);
    expect(elapsed).toBeLessThan(500);
  });
});
