/**
 * Public entry of the engine. ui/ may import ONLY from this file.
 */
import { Engine, type EngineOptions } from './Engine';
import type { EngineHandle } from './types';

export type { EngineHandle } from './types';
export type { EngineOptions } from './Engine';

export function createEngine(options?: EngineOptions): EngineHandle {
  return new Engine(options);
}
