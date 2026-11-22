import { TestBed } from '@angular/core/testing';
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

    store.keepCuttingPlan(plan, legs);

    expect(store.generated()).toEqual({ plan, input: legs });
  });

  it('starts a new job again in a fresh app', () => {
    const first = TestBed.inject(CutOptimizerStore);
    first.setStock([{ id: 1, length: '2400', quantity: '' }]);
    first.setCutList([{ id: 1, name: 'leg', length: '720', quantity: '2' }]);
    first.setJobSettingsEdits({ trim: '10 mm' });
    first.keepCuttingPlan(planCuts(legs), legs);
    TestBed.resetTestingModule();

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
