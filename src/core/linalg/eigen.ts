/**
 * Eigenvalues and real eigenspaces of small square matrices (n ≤ 3).
 *
 * Pipeline: roots of the characteristic polynomial (closed form) → near-real conjugate pairs
 * snapped to the real axis → near-equal real roots clustered into one repeated eigenvalue →
 * eigenspace ker(A − λI) for every distinct real λ, with a rank decision that accounts for the
 * error in λ.
 */
import type { Complex, EigenResult, EigenSpace } from '../analysis';
import { eigenClusterTolFor, nilpotentTol, tolFor } from '../tolerance';
import { det } from './lu';
import type { Matrix, Vec } from './matrix';
import { addScaledIdentity, trace } from './ops';
import { rightSingular } from './svd';

/**
 * Largest n `eigen` accepts. A deliberate v1 limit: the app shows 2D and 3D maps, and n ≤ 3 has
 * reliable closed-form roots. Larger n would need an iterative solver (e.g. Hessenberg QR).
 */
export const EIGEN_MAX_N = 3;

/** Roots of the characteristic polynomial before clustering. */
export interface RawRoots {
  readonly reals: number[];
  /** The +im member of each non-real conjugate pair (im > 0). */
  readonly pairs: Complex[];
}

/** A run of numerically equal real roots, represented by their mean. */
interface Cluster {
  readonly value: number;
  readonly count: number;
  /**
   * Bound on |λ_true − value| that the eigenspace rank decision must tolerate: max − min of
   * the member roots for a clustered root (0 for a simple root), or the backward error of the
   * numerically nilpotent test for a detected triple root (see roots3).
   */
  readonly spread: number;
}

/** The 3×3 case where A − (tr/3)·I is numerically nilpotent: one eigenvalue, multiplicity 3. */
interface TripleRoot {
  readonly triple: Cluster;
}

/**
 * Eigen-analysis of a square matrix with n ≤ 3.
 *
 * - n = 1, 2: closed form. For n = 2 the discriminant is ((a − d)/2)² + bc, computed from the
 *   entries so that tr²/4 − det does not cancel.
 * - n = 3: roots of det(λI − A) = λ³ − tr·λ² + c₁·λ − det, solved after the shift
 *   λ = tr/3 + s·μ, where B = (A − (tr/3)·I)/s and s = max|B_ij|. This gives the depressed cubic
 *   μ³ + pμ + q with p = c₁(B) (the sum of the principal 2×2 minors) and q = −det(B), both
 *   computed from B's entries. That avoids the cancellation of forming the shifted coefficients
 *   from tr, c₁ and det of A. The most isolated real root (trigonometric form for three real
 *   roots, Cardano's formula for one) is polished with up to 2 guarded Newton steps on the
 *   cubic. The other two roots come from exact deflation (see depressedCubicRoots), which keeps
 *   Σλ = tr exactly and makes a complex pair an exact conjugate.
 *
 * A triple eigenvalue is detected before any root is computed, by a nilpotency test on the
 * shifted matrix (see roots3). Its roots would otherwise scatter by ≈ ε^{1/3}·‖A‖ and miss the
 * cluster tolerance.
 *
 * A conjugate pair a ± ib whose members are closer than eigenClusterTolFor(A) (2|b| ≤ tol) is
 * treated as the two real roots a ± b. Real roots are then clustered by single linkage (a gap
 * ≤ tol between neighbours) into one eigenvalue with algebraic multiplicity k, valued at the
 * cluster mean. The mean keeps Σλ = tr A.
 *
 * Throws a RangeError for non-square input and for n > 3 (EIGEN_MAX_N, a deliberate v1 limit).
 */
export function eigen(m: Matrix): EigenResult {
  if (m.rows !== m.cols) throw new RangeError(`eigen: non-square ${m.rows}×${m.cols} matrix`);
  const n = m.rows;
  if (n > EIGEN_MAX_N) {
    throw new RangeError(`eigen: n = ${n} is not supported (v1 handles n ≤ ${EIGEN_MAX_N})`);
  }
  const clusterTol = eigenClusterTolFor(m);
  const raw = n === 1 ? { reals: [m.data[0]], pairs: [] } : n === 2 ? roots2(m) : roots3(m);
  let clusters: Cluster[];
  let pairs: Complex[];
  if ('triple' in raw) {
    clusters = [raw.triple];
    pairs = [];
  } else {
    const snapped = snapNearRealPairs(raw, clusterTol);
    clusters = clusterReals(snapped.reals, clusterTol);
    pairs = [...snapped.pairs].sort((x, y) => y.re - x.re);
  }

  const values: Complex[] = [];
  const spaces: EigenSpace[] = [];
  let defective = false;
  const baseTol = tolFor(m);
  for (const c of clusters) {
    const basis = realEigenspace(m, c, baseTol);
    const value = { re: c.value, im: 0 };
    for (let k = 0; k < c.count; k++) values.push(value);
    spaces.push({
      value,
      algebraicMultiplicity: c.count,
      geometricMultiplicity: basis.length,
      basis,
    });
    if (basis.length < c.count) defective = true;
  }
  for (const z of pairs) {
    for (const value of [z, { re: z.re, im: -z.im }]) {
      values.push(value);
      spaces.push({ value, algebraicMultiplicity: 1, geometricMultiplicity: 0, basis: [] });
    }
  }
  return { values, spaces, defective };
}

/** λ = (a + d)/2 ± √(((a − d)/2)² + bc). */
function roots2(m: Matrix): RawRoots {
  const [a, b, c, d] = m.data;
  const mid = (a + d) / 2;
  const h = (a - d) / 2;
  const disc = h * h + b * c;
  if (disc >= 0) {
    const r = Math.sqrt(disc);
    return { reals: [mid + r, mid - r], pairs: [] };
  }
  return { reals: [], pairs: [{ re: mid, im: Math.sqrt(-disc) }] };
}

/**
 * Roots of the 3×3 characteristic polynomial via the scaled, shifted depressed cubic.
 *
 * Triple roots. λ is a triple eigenvalue exactly when B = (A − (tr/3)·I)/s is nilpotent, i.e.
 * p = q = 0. The computed p, q then hold only rounding error, bounded by κ = nilpotentTol(shift,
 * s) (derived in tolerance.ts). Solving the cubic anyway would scatter the roots by ≈ κ^{1/3}·s,
 * typically more than eigenClusterTolFor, so a rotated Jordan block would come out as one real
 * root plus a complex pair. So |p|, |q| ≤ κ returns λ = tr/3 with multiplicity 3. The mean
 * tr/3 is accurate to rounding, because the trace is perfectly conditioned.
 *
 * Normal matrices are never caught by this test. Since max|b_ij| = 1, a symmetric B has
 * p = −½‖B‖_F² ≤ −½. Only strongly non-normal, near-Jordan B can have tiny p and q, and their
 * eigenvalues are only determined to ≈ κ^{1/3}·s anyway.
 *
 * Spread of the detected triple, used by the eigenspace rank decision (realEigenspace). The
 * input is treated as a rounding-level perturbation of a matrix A₀ with an exact triple
 * eigenvalue λ₀. By Weyl's inequality, σ_k(A − λ̂I) differs from σ_k(A₀ − λ₀I) by at most
 * ‖A − A₀‖₂ + |λ̂ − λ₀|. Both terms are at the backward-error level κ·s = O(ε)·(s + |shift|), not
 * κ^{1/3}·s. So spread = κ·s, which is far below tolFor. Using κ^{1/3}·s would over-count. For
 * example, a rotated [[2,1,0],[0,2,1e-6],[0,0,2]] would get geometric multiplicity 2, while the
 * same matrix unrotated gets 1 (its σ₂ = 1e-6 is a real feature, far above rounding).
 */
function roots3(m: Matrix): RawRoots | TripleRoot {
  const shift = trace(m) / 3;
  const b = addScaledIdentity(m, -shift);
  let s = 0;
  for (const x of b.data) s = Math.max(s, Math.abs(x));
  if (s === 0) return { triple: { value: shift, count: 3, spread: 0 } };
  for (let k = 0; k < 9; k++) b.data[k] /= s;
  const e = b.data;
  const p = e[0] * e[4] - e[1] * e[3] + e[0] * e[8] - e[2] * e[6] + e[4] * e[8] - e[5] * e[7];
  const q = -det(b);
  const kappa = nilpotentTol(shift, s);
  if (Math.abs(p) <= kappa && Math.abs(q) <= kappa) {
    return { triple: { value: shift, count: 3, spread: kappa * s } };
  }
  const mu = depressedCubicRoots(p, q);
  return {
    reals: mu.reals.map((x) => shift + s * x),
    pairs: mu.pairs.map((z) => ({ re: shift + s * z.re, im: s * z.im })),
  };
}

/**
 * Roots of μ³ + pμ + q = 0 (real p, q).
 *
 * Only ONE real root r is computed directly: the most isolated one, i.e. the one with the
 * largest |f′(r)| = |Π(r − other roots)|, so it is well conditioned. It is Newton-polished.
 * The other two come from exact deflation, μ³ + pμ + q = (μ − r)(μ² + rμ + (p + r²)), so they are
 * −r/2 ± √(−(p + ¾r²)). This keeps Σμ = 0 exactly. A near-double pair keeps an accurate mean
 * −r/2, even though the pair's split is only known to ≈ √ε (inherent to a double root).
 * Polishing the members of such a pair one by one would instead move each by ≈ √ε
 * independently. A complex pair comes out as an exact conjugate.
 */
export function depressedCubicRoots(p: number, q: number): RawRoots {
  const r = polishCubicRoot(p, q, isolatedRealRoot(p, q));
  const re = -r / 2;
  const k = p + 0.75 * r * r;
  if (k > 0) return { reals: [r], pairs: [{ re, im: Math.sqrt(k) }] };
  const h = Math.sqrt(-k);
  return { reals: [r, re + h, re - h], pairs: [] };
}

/**
 * A real root of μ³ + pμ + q of largest magnitude. Since Σμ = 0 and f′(μ) = 3μ² + p, this is
 * the root with the largest |f′|.
 *
 * - One real root (d = (q/2)² + (p/3)³ > 0): Cardano. u³ = −q/2 − sign(q)·√d has the sign
 *   of −q, so the sum does not cancel, and v = −p/(3u).
 * - Three real roots: the trigonometric form μ_k = 2t·cos((φ − 2πk)/3), with t = √(−p/3) and
 *   cos φ = −q/(2t³) (clamped against rounding). The largest |μ_k| is taken.
 */
function isolatedRealRoot(p: number, q: number): number {
  const d = (q / 2) * (q / 2) + (p / 3) * (p / 3) * (p / 3);
  if (d > 0) {
    const u = -(q >= 0 ? 1 : -1) * Math.cbrt(Math.abs(q) / 2 + Math.sqrt(d));
    return u === 0 ? 0 : u - p / (3 * u);
  }
  if (p >= 0) return 0; // d ≤ 0 with p ≥ 0 forces p = q = 0: a triple root at 0.
  const t = Math.sqrt(-p / 3);
  const phi = Math.acos(Math.min(1, Math.max(-1, -q / (2 * t * t * t))));
  let best = 0;
  for (let k = 0; k < 3; k++) {
    const mu = 2 * t * Math.cos((phi - 2 * Math.PI * k) / 3);
    if (Math.abs(mu) > Math.abs(best)) best = mu;
  }
  return best;
}

/** Number of Newton steps used to polish each real cubic root. */
const NEWTON_STEPS = 2;

/**
 * Up to NEWTON_STEPS Newton steps on f(μ) = μ³ + pμ + q. A step is kept only if it reduces
 * |f|, so a root near a multiple root (where f′ ≈ 0) is never thrown off.
 */
function polishCubicRoot(p: number, q: number, x0: number): number {
  let x = x0;
  let fx = cubic(p, q, x);
  for (let i = 0; i < NEWTON_STEPS && fx !== 0; i++) {
    const df = 3 * x * x + p;
    if (df === 0) break;
    const xn = x - fx / df;
    const fn = cubic(p, q, xn);
    if (!(Math.abs(fn) < Math.abs(fx))) break;
    x = xn;
    fx = fn;
  }
  return x;
}

function cubic(p: number, q: number, x: number): number {
  return x * (x * x + p) + q;
}

/**
 * A conjugate pair a ± ib with 2|b| ≤ tol is indistinguishable from a repeated real root at
 * this tolerance (a perturbed double root splits either along or across the real axis). It is
 * replaced by the real values a ± b, which keep the sum and get clustered next.
 */
function snapNearRealPairs(raw: RawRoots, tol: number): RawRoots {
  const reals = [...raw.reals];
  const pairs: Complex[] = [];
  for (const z of raw.pairs) {
    if (2 * Math.abs(z.im) <= tol) reals.push(z.re + z.im, z.re - z.im);
    else pairs.push(z);
  }
  return { reals, pairs };
}

/** Sort descending and merge neighbours with gap ≤ tol into clusters valued at their mean. */
function clusterReals(reals: readonly number[], tol: number): Cluster[] {
  const sorted = [...reals].sort((x, y) => y - x);
  const clusters: Cluster[] = [];
  let start = 0;
  for (let i = 1; i <= sorted.length; i++) {
    if (i < sorted.length && sorted[i - 1] - sorted[i] <= tol) continue;
    let sum = 0;
    for (let k = start; k < i; k++) sum += sorted[k];
    clusters.push({
      value: sum / (i - start),
      count: i - start,
      spread: sorted[start] - sorted[i - 1],
    });
    start = i;
  }
  return clusters;
}

/**
 * Orthonormal basis of ker(A − λ̂I) for an approximate eigenvalue λ̂ (a cluster mean).
 *
 * Rank decision. λ̂ = λ + δ, so N = A − λ̂I = (A − λI) − δI. By Weyl's inequality every singular
 * value of N lies within |δ|·‖I‖₂ = |δ| of the matching singular value of the exactly singular
 * A − λI. The zero singular values of A − λI therefore show up as σ ≤ |δ|, and the threshold
 * has to be at least a bound on |δ|:
 *   - for a simple, Newton-polished root, |δ| is at rounding level, covered by tolFor(A);
 *   - for a cluster, the true eigenvalues lie within about the cluster's spread of the mean
 *     (e.g. diag(1, 1 + 1e-7, 2) clusters at 1 + 5e-8 with spread 1e-7, so N has σ = 5e-8
 *     twice).
 * So τ = tolFor(A) + spread, and the geometric multiplicity is #{σ_i(N) ≤ τ}. RREF pivots would
 * be the wrong yardstick here: a perturbation δ of N can move them by a factor up to
 * ‖N‖/|pivot|, while singular values move by at most |δ|. The singular values come from a
 * one-sided Jacobi SVD (svd.ts), which resolves small σ to ≈ ε·‖N‖.
 *
 * The result is clamped to 1 ≤ geometric ≤ algebraic. When no σ falls below τ (a badly
 * conditioned eigenvalue), the right singular vector of the smallest σ is used: the best
 * one-dimensional approximation of the eigenspace. When more than k fall below τ, the k
 * directions with the smallest σ are kept.
 */
function realEigenspace(a: Matrix, c: Cluster, baseTol: number): Vec[] {
  const n = a.rows;
  const { values, vectors } = rightSingular(addScaledIdentity(a, -c.value));
  const tau = baseTol + c.spread;
  let small = 0;
  for (let i = n - 1; i >= 0 && values[i] <= tau; i--) small++;
  const g = Math.min(c.count, Math.max(1, small));
  const basis: Vec[] = [];
  for (let i = n - 1; i >= n - g; i--) basis.push(canonicalSign(vectors[i]));
  return basis;
}

/**
 * Flip v so that its largest-magnitude component is positive. This makes eigenvectors
 * deterministic, so overlays do not flicker between ±v from frame to frame.
 */
function canonicalSign(v: Vec): Vec {
  let k = 0;
  for (let i = 1; i < v.length; i++) if (Math.abs(v[i]) > Math.abs(v[k])) k = i;
  if (v[k] < 0) for (let i = 0; i < v.length; i++) v[i] = -v[i];
  return v;
}
