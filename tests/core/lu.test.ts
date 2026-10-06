import { describe, expect, it } from 'vitest';
import { det, inverse, isSingularLU, lu, solve } from '../../src/core/linalg/lu';
import { fromRows, identity, matrix, type Matrix } from '../../src/core/linalg/matrix';
import { apply, mul, scale } from '../../src/core/linalg/ops';
import { rank } from '../../src/core/linalg/rref';
import { tolFor } from '../../src/core/tolerance';
import { randomMatrix, scaleOf } from './helpers';
import { mulberry32 } from './prng';

function maxAbsDiff(a: Matrix, b: Matrix): number {
  let d = 0;
  for (let k = 0; k < a.data.length; k++) d = Math.max(d, Math.abs(a.data[k] - b.data[k]));
  return d;
}

describe('lu', () => {
  it('reconstructs P·A = L·U', () => {
    const rng = mulberry32(3);
    for (const n of [1, 2, 3, 4, 5]) {
      const a = randomMatrix(rng, n, n);
      const { lu: f, perm } = lu(a);
      const l = matrix(n, n);
      const u = matrix(n, n);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (j < i) l.data[i * n + j] = f.data[i * n + j];
          else u.data[i * n + j] = f.data[i * n + j];
        }
        l.data[i * n + i] = 1;
      }
      const pa = matrix(n, n);
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) pa.data[i * n + j] = a.data[perm[i] * n + j];
      expect(maxAbsDiff(mul(l, u), pa)).toBeLessThan(1e-12 * scaleOf(a));
    }
  });

  it('det of diagonal, triangular and permuted matrices', () => {
    expect(det(fromRows([[4]]))).toBe(4);
    expect(
      det(
        fromRows([
          [2, 0, 0],
          [0, 3, 0],
          [0, 0, -1],
        ]),
      ),
    ).toBe(-6);
    expect(
      det(
        fromRows([
          [0, 1],
          [1, 0],
        ]),
      ),
    ).toBe(-1);
    expect(
      det(
        fromRows([
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ]),
      ),
    ).toBeCloseTo(0, 12);
  });

  it('det is multiplicative and scales as cⁿ (random, seeded)', () => {
    const rng = mulberry32(11);
    for (let k = 0; k < 100; k++) {
      const n = 1 + (k % 4);
      const a = randomMatrix(rng, n, n);
      const b = randomMatrix(rng, n, n);
      const tol = 1e-12 * (scaleOf(a) * scaleOf(b)) ** n;
      expect(Math.abs(det(mul(a, b)) - det(a) * det(b))).toBeLessThan(tol);
      expect(Math.abs(det(scale(a, -2)) - (-2) ** n * det(a))).toBeLessThan(tol * 2 ** n);
    }
  });

  it('solve and inverse satisfy A·x = b and A·A⁻¹ = I (random, seeded)', () => {
    const rng = mulberry32(12);
    for (let k = 0; k < 100; k++) {
      const n = 1 + (k % 4);
      const a = randomMatrix(rng, n, n);
      if (rank(a) < n) {
        expect(() => inverse(a)).toThrow(RangeError);
        continue;
      }
      const b = Float64Array.from({ length: n }, () => rng() - 0.5);
      const x = solve(a, b);
      const ax = apply(a, x);
      const condTol = 1e-9 * scaleOf(a) * scaleOf(inverse(a));
      for (let i = 0; i < n; i++) expect(Math.abs(ax[i] - b[i])).toBeLessThan(condTol);
      expect(maxAbsDiff(mul(a, inverse(a)), identity(n))).toBeLessThan(condTol);
    }
  });

  it('inverse throws on singular input (relative tolerance)', () => {
    expect(() =>
      inverse(
        fromRows([
          [1, 2],
          [2, 4],
        ]),
      ),
    ).toThrow(RangeError);
    expect(() =>
      inverse(
        fromRows([
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ]),
      ),
    ).toThrow(RangeError);
    expect(() => inverse(matrix(3, 3))).toThrow(RangeError);
    expect(() =>
      solve(
        fromRows([
          [0, 1],
          [0, 2],
        ]),
        [1, 2],
      ),
    ).toThrow(RangeError);
    // A tiny but well-conditioned matrix: 1e-12·I is below tolFor, so it counts as singular.
    expect(() => inverse(scale(identity(2), 1e-12))).toThrow(RangeError);
    expect(() => inverse(matrix(2, 3))).toThrow(RangeError);
  });

  it('singularity under LU agrees with rank < n (same pivots, same tolerance)', () => {
    const rng = mulberry32(13);
    for (let k = 0; k < 300; k++) {
      const n = 2 + (k % 2);
      const a = randomMatrix(rng, n, n);
      expect(isSingularLU(lu(a), tolFor(a))).toBe(rank(a) < n);
    }
  });
});
