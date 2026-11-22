import { TestBed } from '@angular/core/testing';
import { SettingsStore } from '../../core/settings/settings-store';
import { translocoTesting } from '../../../testing/transloco-testing';
import type { CutOptimizerInput } from './cut-optimizer.calc';
import { planCuts } from './cut-optimizer.calc';
import { CutOptimizerStore } from './cut-optimizer.store';

/** Two 720 mm legs from one 2400 mm Stock. */
const legs: CutOptimizerInput = {
  stock: [{ lengthMillimetres: 2400 }],
  cutList: [{ name: 'leg', lengthMillimetres: 720, quantity: 2 }],
  settings: {
    kerfMillimetres: 3,
    trimMillimetres: 0,
    minimumOffcutLengthMillimetres: 300,
    strategy: 'fewest-stock',
  },
};

describe('CutOptimizerStore', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [translocoTesting()] });
  });

  it('starts with one empty Stock entry, one empty Part, the defaults and no Cutting Plan', () => {
    const store = TestBed.inject(CutOptimizerStore);

    expect({
      stock: store.stock(),
      cutList: store.cutList(),
      jobSettingsEdits: store.jobSettingsEdits(),
      strategy: store.strategy(),
      generated: store.generated(),
    }).toEqual({
      stock: [{ id: 1, length: '', quantity: '' }],
      cutList: [{ id: 1, name: '', length: '', quantity: '' }],
      jobSettingsEdits: {},
      strategy: 'fewest-stock',
      generated: undefined,
    });
  });

  it('keeps the Stock, the Cut List and the job settings changed in this job', () => {
    const store = TestBed.inject(CutOptimizerStore);

    store.setStock([
      { id: 1, length: '2400', quantity: '' },
      { id: 3, length: '1200 mm', quantity: '2' },
    ]);
    store.setCutList([{ id: 2, name: 'leg', length: '720', quantity: '4' }]);
    store.setJobSettingsEdits({ kerf: '2.5 mm' });

    expect({
      stock: store.stock(),
      cutList: store.cutList(),
      jobSettingsEdits: store.jobSettingsEdits(),
    }).toEqual({
      stock: [
        { id: 1, length: '2400', quantity: '' },
        { id: 3, length: '1200 mm', quantity: '2' },
      ],
      cutList: [{ id: 2, name: 'leg', length: '720', quantity: '4' }],
      jobSettingsEdits: { kerf: '2.5 mm' },
    });
  });

  it('keeps the last Cutting Plan with the input it was generated from', () => {
    const store = TestBed.inject(CutOptimizerStore);
    const plan = planCuts(legs);

    store.keepCuttingPlan(plan, legs, store.inputSnapshot());

    expect(store.generated()).toMatchObject({ plan, input: legs });
  });

  describe('out of date', () => {
    function withPlan(): CutOptimizerStore {
      const store = TestBed.inject(CutOptimizerStore);
      store.keepCuttingPlan(planCuts(legs), legs, store.inputSnapshot());
      return store;
    }

    it('is not out of date with no Cutting Plan', () => {
      const store = TestBed.inject(CutOptimizerStore);
      store.setStock([{ id: 1, length: '2400', quantity: '' }]);

      expect(store.outOfDate()).toBe(false);
    });

    it('is up to date right after a Cutting Plan is kept', () => {
      expect(withPlan().outOfDate()).toBe(false);
    });

    it.each<[string, (store: CutOptimizerStore) => void]>([
      [
        'the Stock',
        (store): void => {
          store.setStock([{ id: 1, length: '1200', quantity: '' }]);
        },
      ],
      [
        'the Cut List',
        (store): void => {
          store.setCutList([{ id: 1, name: '', length: '300', quantity: '1' }]);
        },
      ],
      [
        'a job setting',
        (store): void => {
          store.setJobSettingsEdits({ kerf: '4' });
        },
      ],
      [
        'a default',
        (): void => {
          TestBed.inject(SettingsStore).setCutOptimizerKerf(2);
        },
      ],
      [
        'the Unit System',
        (): void => {
          TestBed.inject(SettingsStore).setUnitSystem('imperial');
        },
      ],
    ])('is out of date once %s changes', (_, change): void => {
      TestBed.inject(SettingsStore).setUnitSystem('metric');
      const store = withPlan();

      change(store);

      expect(store.outOfDate()).toBe(true);
    });

    it('stays up to date when only the Imperial precision changes, since it only changes how lengths are shown', () => {
      const store = withPlan();

      TestBed.inject(SettingsStore).setImperialPrecision(8);

      expect(store.outOfDate()).toBe(false);
    });

    it('is out of date when the input changed while the plan was built', () => {
      const store = TestBed.inject(CutOptimizerStore);
      const generatedFrom = store.inputSnapshot();
      store.setJobSettingsEdits({ kerf: '4' });

      store.keepCuttingPlan(planCuts(legs), legs, generatedFrom);

      expect(store.outOfDate()).toBe(true);
    });

    it('is not out of date once the Cutting Plan is dropped', () => {
      const store = withPlan();
      store.setStock([{ id: 1, length: '1200', quantity: '' }]);

      store.dropCuttingPlan();

      expect([store.generated(), store.outOfDate()]).toEqual([undefined, false]);
    });
  });

  it('starts a new job again in a fresh app', () => {
    const first = TestBed.inject(CutOptimizerStore);
    first.setStock([{ id: 1, length: '2400', quantity: '' }]);
    first.setCutList([{ id: 1, name: 'leg', length: '720', quantity: '2' }]);
    first.setJobSettingsEdits({ trim: '10 mm' });
    first.keepCuttingPlan(planCuts(legs), legs, first.inputSnapshot());
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [translocoTesting()] });

    const store = TestBed.inject(CutOptimizerStore);

    expect({
      stock: store.stock(),
      cutList: store.cutList(),
      jobSettingsEdits: store.jobSettingsEdits(),
      generated: store.generated(),
    }).toEqual({
      stock: [{ id: 1, length: '', quantity: '' }],
      cutList: [{ id: 1, name: '', length: '', quantity: '' }],
      jobSettingsEdits: {},
      generated: undefined,
    });
  });
});
