/**
 * Public entry of the engine. ui/ may import ONLY from this file.
 *
 * STUB (head agent): no-op engine so ui/ can be developed in parallel.
 * The engine agent replaces createEngine with the real implementation (Engine.ts).
 */
import type { EngineHandle } from './types';

export type { EngineHandle } from './types';

export function createEngine(): EngineHandle {
  return {
    mount() {},
    dispatch() {},
    dispose() {},
  };
}
