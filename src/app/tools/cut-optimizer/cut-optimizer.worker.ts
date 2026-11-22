/// <reference lib="webworker" />
// Runs the Cut Optimizer engine off the page's main thread. It only passes messages:
// every rule of the Cutting Plan lives in `planCuts`.
import type { CutOptimizerInput } from './cut-optimizer.calc';
import { planCuts } from './cut-optimizer.calc';

addEventListener('message', (event: MessageEvent<CutOptimizerInput>) => {
  postMessage(planCuts(event.data));
});
