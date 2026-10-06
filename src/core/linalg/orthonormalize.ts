import { REL_TOL } from '../tolerance';
import type { Vec } from './matrix';

/**
 * Orthonormalise `vectors` with modified Gram–Schmidt, applied twice: each vector is projected
 * off every accepted basis vector one at a time (MGS), then the projection is repeated once to
 * remove the rounding error the first pass leaves behind (re-orthogonalisation).
 *
 * A vector is dropped when the part left after projection is at most `relTol` times its
 * original length, i.e. when it lies (numerically) in the span of the earlier ones. A zero
 * vector is always dropped. The inputs are not mutated.
 */
export function orthonormalize(vectors: readonly ArrayLike<number>[], relTol = REL_TOL): Vec[] {
  const basis: Vec[] = [];
  for (const v of vectors) {
    const w = Float64Array.from(v);
    const original = length(w);
    if (original === 0) continue;
    for (let pass = 0; pass < 2; pass++) {
      for (const q of basis) subtractProjection(w, q);
    }
    const residual = length(w);
    if (residual <= relTol * original) continue;
    for (let i = 0; i < w.length; i++) w[i] /= residual;
    basis.push(w);
  }
  return basis;
}

/** w ← w − ⟨w, q⟩·q for a unit vector q. */
function subtractProjection(w: Vec, q: Vec): void {
  let d = 0;
  for (let i = 0; i < w.length; i++) d += w[i] * q[i];
  for (let i = 0; i < w.length; i++) w[i] -= d * q[i];
}

function length(w: Vec): number {
  let s = 0;
  for (let i = 0; i < w.length; i++) s += w[i] * w[i];
  return Math.sqrt(s);
}
