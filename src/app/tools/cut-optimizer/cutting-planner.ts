import { InjectionToken } from '@angular/core';
import type { CutOptimizerInput, CuttingPlan } from './cut-optimizer.calc';

/** Builds a Cutting Plan without blocking the page. */
export type CuttingPlanner = (input: CutOptimizerInput) => Promise<CuttingPlan>;

/**
 * Builds the Cutting Plan in a Web Worker, so the page stays responsive while the engine runs.
 * Each plan gets a worker of its own, closed once the plan arrives.
 */
export const planCutsInWorker: CuttingPlanner = async (input) =>
  new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./cut-optimizer.worker', import.meta.url), {
      type: 'module',
    });
    worker.addEventListener('message', (event: MessageEvent<CuttingPlan>) => {
      worker.terminate();
      resolve(event.data);
    });
    worker.addEventListener('error', (event) => {
      worker.terminate();
      reject(new Error(`The Cutting Plan could not be built: ${event.message}`));
    });
    worker.addEventListener('messageerror', () => {
      worker.terminate();
      reject(new Error('The Cutting Plan could not be read from the worker.'));
    });
    worker.postMessage(input);
  });

/** How the Cut Optimizer page builds the Cutting Plan: in a Web Worker unless replaced. */
export const CUTTING_PLANNER = new InjectionToken<CuttingPlanner>('CUTTING_PLANNER', {
  providedIn: 'root',
  factory: (): CuttingPlanner => planCutsInWorker,
});
