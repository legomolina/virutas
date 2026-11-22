import type { CutListEntryTexts } from './cut-list-entry.calc';
import type { CuttingPlanRequestTexts } from './cutting-plan-request.calc';
import { readCuttingPlanRequest } from './cutting-plan-request.calc';
import type { JobSettingsTexts } from './job-settings.calc';
import type { StockEntryTexts } from './stock-entry.calc';

const JOB: JobSettingsTexts = { kerf: '3 mm', trim: '5 mm', minimumOffcutLength: '300 mm' };

function stock(length: string, quantity = ''): StockEntryTexts {
  return { length, quantity };
}

function part(length: string, quantity: string, name = ''): CutListEntryTexts {
  return { name, length, quantity };
}

function texts(overrides: Partial<CuttingPlanRequestTexts> = {}): CuttingPlanRequestTexts {
  return {
    stock: [stock('2400', '3')],
    cutList: [part('720', '6', 'leg')],
    jobSettings: JOB,
    strategy: 'fewest-stock',
    ...overrides,
  };
}

describe('readCuttingPlanRequest', () => {
  it('reads valid Stock, Cut List and job settings into the engine input, in millimetres', () => {
    expect(
      readCuttingPlanRequest(
        texts({
          stock: [stock('2400', '3'), stock('1800 mm')],
          cutList: [part('720', '6', ' leg '), part('54 cm', '4')],
        }),
        'metric',
      ),
    ).toEqual({
      ok: true,
      input: {
        stock: [{ lengthMillimetres: 2400, quantity: 3 }, { lengthMillimetres: 1800 }],
        cutList: [
          { name: 'leg', lengthMillimetres: 720, quantity: 6 },
          { lengthMillimetres: 540, quantity: 4 },
        ],
        settings: {
          kerfMillimetres: 3,
          trimMillimetres: 5,
          minimumOffcutLengthMillimetres: 300,
          strategy: 'fewest-stock',
        },
      },
    });
  });

  it('reads bare numbers in the preferred Unit System', () => {
    const request = readCuttingPlanRequest(
      texts({
        stock: [stock('50')],
        cutList: [part('10', '1')],
        jobSettings: { kerf: '1/8', trim: '0', minimumOffcutLength: '5' },
      }),
      'imperial',
    );

    expect(request).toEqual({
      ok: true,
      input: {
        stock: [{ lengthMillimetres: 1270 }],
        cutList: [{ lengthMillimetres: 254, quantity: 1 }],
        settings: {
          kerfMillimetres: 3.175,
          trimMillimetres: 0,
          minimumOffcutLengthMillimetres: 127,
          strategy: 'fewest-stock',
        },
      },
    });
  });

  it('leaves out entries that are completely blank', () => {
    const request = readCuttingPlanRequest(
      texts({
        stock: [stock(' ', ''), stock('2400')],
        cutList: [part('', '', '  '), part('720', '2')],
      }),
      'metric',
    );

    expect(request.ok && [request.input.stock, request.input.cutList]).toEqual([
      [{ lengthMillimetres: 2400 }],
      [{ lengthMillimetres: 720, quantity: 2 }],
    ]);
  });

  it('leaves out blank entries as typed on the page, with their id', () => {
    const blankStock = { id: 1, ...stock('') };
    const blankPart = { id: 2, ...part('', '') };

    const request = readCuttingPlanRequest(
      texts({ stock: [blankStock, stock('2400')], cutList: [part('720', '2'), blankPart] }),
      'metric',
    );

    expect(request.ok).toBe(true);
  });

  it.each([
    ['an unreadable Stock length', texts({ stock: [stock('24oo')] })],
    ['a Stock quantity of zero', texts({ stock: [stock('2400', '0')] })],
    ['a Part length of zero', texts({ cutList: [part('0', '2')] })],
    ['a Part quantity that is not whole', texts({ cutList: [part('720', '1.5')] })],
    ['a negative Kerf', texts({ jobSettings: { ...JOB, kerf: '-1' } })],
    ['an unreadable Trim', texts({ jobSettings: { ...JOB, trim: 'abc' } })],
    ['an empty minimum Offcut length', texts({ jobSettings: { ...JOB, minimumOffcutLength: '' } })],
  ])('is blocked by invalid fields with %s', (_, input) => {
    expect(readCuttingPlanRequest(input, 'metric')).toEqual({
      ok: false,
      reason: 'invalid-fields',
    });
  });

  it.each([
    ['a Stock with a quantity but no length', texts({ stock: [stock('', '2')] })],
    ['a Part with a name only', texts({ cutList: [part('', '', 'leg')] })],
    ['a Part with no quantity', texts({ cutList: [part('720', '')] })],
    ['a Part with no length', texts({ cutList: [part('', '2')] })],
  ])('is blocked by incomplete entries with %s', (_, input) => {
    expect(readCuttingPlanRequest(input, 'metric')).toEqual({
      ok: false,
      reason: 'incomplete-entries',
    });
  });

  it('reports invalid fields before incomplete entries', () => {
    expect(
      readCuttingPlanRequest(
        texts({ stock: [stock('', '2'), stock('abc')], cutList: [part('720', '')] }),
        'metric',
      ),
    ).toEqual({ ok: false, reason: 'invalid-fields' });
  });

  it.each([
    ['no Stock', texts({ stock: [] })],
    ['only blank Stock', texts({ stock: [stock('')] })],
    ['no Parts', texts({ cutList: [] })],
    ['only blank Parts', texts({ cutList: [part('', '')] })],
  ])('is blocked by missing entries with %s', (_, input) => {
    expect(readCuttingPlanRequest(input, 'metric')).toEqual({
      ok: false,
      reason: 'missing-entries',
    });
  });

  it('reports incomplete entries before missing ones', () => {
    expect(
      readCuttingPlanRequest(texts({ stock: [stock('', '2')], cutList: [] }), 'metric'),
    ).toEqual({ ok: false, reason: 'incomplete-entries' });
  });
});
