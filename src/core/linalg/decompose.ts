/**
 * FROZEN CONTRACT — decompositions as animatable step sequences.
 *
 * A decomposition A = F_k ⋯ F_2 F_1 is presented as cumulative steps:
 *   step 1: F_1, step 2: F_2 F_1, …, step k: A.
 * The engine's Timeline animates identity → step 1 → … → step k.
 */
import type { Matrix } from './matrix';

export interface Step {
  /** Short human label, e.g. "Stretch (S)". */
  readonly label: string;
  /** KaTeX source for the factor applied in this step, e.g. "S". Optional. */
  readonly latex?: string;
  /** The factor F_i applied in this step. */
  readonly factor: Matrix;
  /** Cumulative map after this step: F_i ⋯ F_1. */
  readonly cumulative: Matrix;
}

export interface Decomposition {
  readonly id: string;
  readonly name: string;
  /** Whether this decomposition is defined (and implemented) for `m`. */
  applicable(m: Matrix): boolean;
  steps(m: Matrix): Step[];
}

const registry = new Map<string, Decomposition>();

export function registerDecomposition(d: Decomposition): void {
  if (registry.has(d.id)) throw new Error(`Decomposition '${d.id}' already registered`);
  registry.set(d.id, d);
}

export function getDecomposition(id: string): Decomposition | undefined {
  return registry.get(id);
}

export function listDecompositions(): Decomposition[] {
  return [...registry.values()];
}
