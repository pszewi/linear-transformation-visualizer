/**
 * Invariant checks shared by the core tests. They verify mathematical properties
 * (‖Av − λv‖, orthonormality, Σλ = tr, Πλ = det, …) rather than restating the implementation.
 */
import { expect } from 'vitest';
import type { Complex, EigenResult } from '../../src/core/analysis';
import { eigenClusterTolFor, normInf, tolFor } from '../../src/core/tolerance';
import { det } from '../../src/core/linalg/lu';
import { matrix, type Matrix, type Vec } from '../../src/core/linalg/matrix';
import { apply, dot, norm2, trace } from '../../src/core/linalg/ops';
import { integer, uniform } from './prng';

/** max(1, ‖A‖∞): the scale every relative tolerance is measured against. */
export function scaleOf(m: Matrix): number {
  return Math.max(1, normInf(m));
}

/** ‖A·v − λ·v‖₂. */
export function eigenResidual(m: Matrix, lambda: number, v: Vec): number {
  const av = apply(m, v);
  let s = 0;
  for (let i = 0; i < v.length; i++) s += (av[i] - lambda * v[i]) ** 2;
  return Math.sqrt(s);
}

/** Every vector has unit length and every pair is orthogonal, within `tol`. */
export function expectOrthonormal(vs: readonly Vec[], tol = 1e-12): void {
  for (let i = 0; i < vs.length; i++) {
    expect(Math.abs(norm2(vs[i]) - 1)).toBeLessThanOrEqual(tol);
    for (let j = 0; j < i; j++) expect(Math.abs(dot(vs[i], vs[j]))).toBeLessThanOrEqual(tol);
  }
}

/** ‖A·v‖ for every v, all within `tol`. */
export function expectInKernel(m: Matrix, vs: readonly Vec[], tol: number): void {
  for (const v of vs) expect(norm2(apply(m, v))).toBeLessThanOrEqual(tol);
}

/** Distance from x to span(basis), for an orthonormal basis. */
export function distanceToSpan(x: ArrayLike<number>, basis: readonly Vec[]): number {
  const r = Float64Array.from(x);
  for (const q of basis) {
    const d = dot(r, q);
    for (let i = 0; i < r.length; i++) r[i] -= d * q[i];
  }
  return norm2(r);
}

function cmul(a: Complex, b: Complex): Complex {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}

/** Σλ and Πλ in complex arithmetic. */
export function sumAndProduct(values: readonly Complex[]): { sum: Complex; product: Complex } {
  let sum: Complex = { re: 0, im: 0 };
  let product: Complex = { re: 1, im: 0 };
  for (const z of values) {
    sum = { re: sum.re + z.re, im: sum.im + z.im };
    product = cmul(product, z);
  }
  return { sum, product };
}

/**
 * Every documented invariant of an EigenResult for the square matrix `m`:
 * count and ordering of `values`, exact conjugate pairs, one space per distinct value in order
 * of first appearance, 1 ≤ geometric ≤ algebraic, orthonormal bases, small ‖Av − λv‖,
 * `defective` consistent, Σλ = tr A and Πλ = det A.
 */
export function expectEigenInvariants(m: Matrix, e: EigenResult): void {
  const n = m.rows;
  const scale = scaleOf(m);
  expect(e.values.length).toBe(n);
  expectDocumentedOrder(e.values);

  const distinct: Complex[] = [];
  for (const z of e.values) {
    const last = distinct[distinct.length - 1];
    if (!last || last.re !== z.re || last.im !== z.im) distinct.push(z);
  }
  expect(e.spaces.map((s) => s.value)).toEqual(distinct);

  let algebraicTotal = 0;
  let defective = false;
  for (const s of e.spaces) {
    const copies = e.values.filter((z) => z.re === s.value.re && z.im === s.value.im).length;
    expect(s.algebraicMultiplicity).toBe(copies);
    algebraicTotal += s.algebraicMultiplicity;
    if (s.value.im !== 0) {
      expect(s.geometricMultiplicity).toBe(0);
      expect(s.basis.length).toBe(0);
      continue;
    }
    expect(s.geometricMultiplicity).toBeGreaterThanOrEqual(1);
    expect(s.geometricMultiplicity).toBeLessThanOrEqual(s.algebraicMultiplicity);
    expect(s.basis.length).toBe(s.geometricMultiplicity);
    expectOrthonormal(s.basis);
    if (s.geometricMultiplicity < s.algebraicMultiplicity) defective = true;
    // A simple eigenvalue is accurate to rounding. A cluster of k roots is only as accurate as
    // its spread, which eigenClusterTolFor bounds.
    const tol = s.algebraicMultiplicity === 1 ? 10 * tolFor(m) : eigenClusterTolFor(m);
    for (const v of s.basis) {
      expect(v.length).toBe(n);
      expect(eigenResidual(m, s.value.re, v)).toBeLessThanOrEqual(tol);
    }
  }
  expect(algebraicTotal).toBe(n);
  expect(e.defective).toBe(defective);

  const { sum, product } = sumAndProduct(e.values);
  expect(Math.abs(sum.re - trace(m))).toBeLessThanOrEqual(tolFor(m));
  expect(Math.abs(sum.im)).toBeLessThanOrEqual(tolFor(m));
  const detTol = tolFor(m) * scale ** (n - 1);
  expect(Math.abs(product.re - det(m))).toBeLessThanOrEqual(detTol);
  expect(Math.abs(product.im)).toBeLessThanOrEqual(detTol);
}

/** Real values first (descending), then conjugate pairs by descending re, +im first. */
function expectDocumentedOrder(values: readonly Complex[]): void {
  let i = 0;
  while (i < values.length && values[i].im === 0) {
    if (i > 0) expect(values[i].re).toBeLessThanOrEqual(values[i - 1].re);
    i++;
  }
  let prevRe = Infinity;
  for (; i < values.length; i += 2) {
    const z = values[i];
    const w = values[i + 1];
    expect(z.im).toBeGreaterThan(0);
    expect(w).toEqual({ re: z.re, im: -z.im });
    expect(z.re).toBeLessThanOrEqual(prevRe);
    prevRe = z.re;
  }
}

/**
 * A random rows×cols matrix. Half the time continuous entries in [−5, 5); otherwise small
 * integers in [−2, 2], which often produce singular, repeated-eigenvalue and defective cases.
 */
export function randomMatrix(rng: () => number, rows: number, cols: number): Matrix {
  const ints = rng() < 0.5;
  const m = matrix(rows, cols);
  for (let k = 0; k < m.data.length; k++) {
    m.data[k] = ints ? integer(rng, -2, 2) : uniform(rng, -5, 5);
  }
  return m;
}

/** A random rotation in SO(3) (Rodrigues' formula about a random axis). */
export function randomRotation3(rng: () => number): Matrix {
  const axis = [uniform(rng, -1, 1), uniform(rng, -1, 1), uniform(rng, -1, 1)];
  return rotation3(axis, uniform(rng, -Math.PI, Math.PI));
}

/** Rotation by `angle` about `axis` (need not be unit length), by Rodrigues' formula. */
export function rotation3(axis: readonly number[], angle: number): Matrix {
  const len = Math.hypot(axis[0], axis[1], axis[2]);
  const [x, y, z] = axis.map((a) => a / len);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  return matrix(3, 3, [
    t * x * x + c,
    t * x * y - s * z,
    t * x * z + s * y,
    t * x * y + s * z,
    t * y * y + c,
    t * y * z - s * x,
    t * x * z - s * y,
    t * y * z + s * x,
    t * z * z + c,
  ]);
}

/** 2D rotation by `angle`. */
export function rotation2(angle: number): Matrix {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return matrix(2, 2, [c, -s, s, c]);
}
