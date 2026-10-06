import { REL_TOL } from '../tolerance';
import { det, inverse } from './lu';
import type { Matrix } from './matrix';
import { mul, transpose } from './ops';
import { rank } from './rref';

/** A = R·S with R orthogonal and S symmetric positive definite. */
export interface PolarDecomposition {
  /** Orthogonal factor. det R = sign(det A), so R ∈ SO(n) exactly when det A > 0. */
  readonly r: Matrix;
  /** Symmetric positive definite factor S = Rᵀ·A, explicitly symmetrised. */
  readonly s: Matrix;
}

/**
 * Cap on Newton iterations. With scaling, the iteration reaches full precision in under ten
 * steps even for condition numbers around 1e12. The cap only stops runaway loops on garbage
 * input.
 */
const POLAR_MAX_ITER = 100;

/**
 * Polar decomposition of a square, invertible matrix by Higham's scaled Newton iteration
 *   X₀ = A,  X_{k+1} = ½(γ_k·X_k + γ_k⁻¹·X_k⁻ᵀ),  γ_k = (‖X_k⁻¹‖_F / ‖X_k‖_F)^{1/2},
 * which converges quadratically to the orthogonal polar factor R. The iteration stops once a
 * step changes X by at most REL_TOL relative to ‖X‖_F. One unscaled step follows, which by
 * quadratic convergence brings X to working precision. Then S = Rᵀ·A, symmetrised.
 *
 * Throws a RangeError if `m` is non-square or singular under tolFor(m).
 */
export function polar(m: Matrix): PolarDecomposition {
  if (m.rows !== m.cols) throw new RangeError(`polar: non-square ${m.rows}×${m.cols} matrix`);
  if (rank(m) < m.rows) throw new RangeError('polar: matrix is singular');
  let x = m;
  for (let k = 0; k < POLAR_MAX_ITER; k++) {
    const next = newtonStep(x, true);
    const change = frobeniusDistance(next, x);
    x = next;
    if (change <= REL_TOL * frobenius(x)) {
      x = newtonStep(x, false);
      break;
    }
  }
  const s = mul(transpose(x), m);
  symmetrize(s);
  return { r: x, s };
}

/** X ← ½(γX + γ⁻¹X⁻ᵀ), with Frobenius-norm scaling γ when `scaled`, else γ = 1. */
function newtonStep(x: Matrix, scaled: boolean): Matrix {
  const invT = transpose(inverse(x));
  const g = scaled ? Math.sqrt(frobenius(invT) / frobenius(x)) : 1;
  const out = { rows: x.rows, cols: x.cols, data: new Float64Array(x.data.length) };
  for (let k = 0; k < out.data.length; k++) out.data[k] = 0.5 * (g * x.data[k] + invT.data[k] / g);
  return out;
}

function frobenius(a: Matrix): number {
  let s = 0;
  for (const v of a.data) s += v * v;
  return Math.sqrt(s);
}

function frobeniusDistance(a: Matrix, b: Matrix): number {
  let s = 0;
  for (let k = 0; k < a.data.length; k++) s += (a.data[k] - b.data[k]) ** 2;
  return Math.sqrt(s);
}

function symmetrize(s: Matrix): void {
  const n = s.rows;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const v = 0.5 * (s.data[i * n + j] + s.data[j * n + i]);
      s.data[i * n + j] = v;
      s.data[j * n + i] = v;
    }
  }
}

/**
 * True when `m` has a polar decomposition with a proper rotation R ∈ SO(n): square,
 * 1 ≤ n ≤ maxN, numerically invertible (rank n) and det > 0.
 */
export function hasRotationPolar(m: Matrix, maxN: number): boolean {
  return m.rows === m.cols && m.rows <= maxN && rank(m) === m.rows && det(m) > 0;
}
