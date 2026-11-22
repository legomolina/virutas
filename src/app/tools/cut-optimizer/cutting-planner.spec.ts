import type { CutOptimizerInput } from './cut-optimizer.calc';
import { planCuts } from './cut-optimizer.calc';
import { planCutsInWorker } from './cutting-planner';

/** A stand-in for the browser's Worker that records what the page does with it. */
class FakeWorker extends EventTarget {
  static readonly created: FakeWorker[] = [];

  readonly url: URL;
  readonly options: WorkerOptions;
  readonly posted: unknown[] = [];
  terminated = false;

  constructor(url: URL, options: WorkerOptions) {
    super();
    this.url = url;
    this.options = options;
    FakeWorker.created.push(this);
  }

  postMessage(message: unknown): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }
}

const input: CutOptimizerInput = {
  stock: [{ lengthMillimetres: 2400 }],
  cutList: [{ name: 'leg', lengthMillimetres: 720, quantity: 1 }],
  settings: {
    kerfMillimetres: 3,
    trimMillimetres: 0,
    minimumOffcutLengthMillimetres: 300,
    strategy: 'fewest-stock',
  },
};

/** What the worker answers with; the planner passes it on untouched. */
const plan = planCuts(input);

function onlyWorker(): FakeWorker {
  expect(FakeWorker.created).toHaveLength(1);
  return FakeWorker.created[0];
}

describe('planCutsInWorker', () => {
  beforeEach(() => {
    FakeWorker.created.length = 0;
    vi.stubGlobal('Worker', FakeWorker);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the input to a module worker and answers with its plan, then closes it', async () => {
    const result = planCutsInWorker(input);
    const worker = onlyWorker();

    expect(worker.options).toEqual({ type: 'module' });
    expect(worker.url.pathname).toMatch(/worker/u);
    expect(worker.posted).toEqual([input]);
    expect(worker.terminated).toBe(false);

    worker.dispatchEvent(new MessageEvent('message', { data: plan }));

    await expect(result).resolves.toBe(plan);
    expect(worker.terminated).toBe(true);
  });

  it('fails, and closes the worker, when the worker fails', async () => {
    const result = planCutsInWorker(input);
    const worker = onlyWorker();

    worker.dispatchEvent(new ErrorEvent('error', { message: 'boom' }));

    await expect(result).rejects.toThrow('The Cutting Plan could not be built: boom');
    expect(worker.terminated).toBe(true);
  });

  it('fails, and closes the worker, when the plan cannot be read', async () => {
    const result = planCutsInWorker(input);
    const worker = onlyWorker();

    worker.dispatchEvent(new MessageEvent('messageerror'));

    await expect(result).rejects.toThrow('The Cutting Plan could not be read from the worker.');
    expect(worker.terminated).toBe(true);
  });
});
