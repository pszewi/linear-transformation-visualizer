import { describe, expect, it } from 'vitest';
import { fromRows, matrix, type Matrix } from '../../src/core/linalg/matrix';
import { scale } from '../../src/core/linalg/ops';
import { orthonormalize } from '../../src/core/linalg/orthonormalize';
import { columnSpace, nullspace, rank, rref } from '../../src/core/linalg/rref';
import { tolFor } from '../../src/core/tolerance';
import {
  distanceToSpan,
  expectInKernel,
  expectOrthonormal,
  randomMatrix,
  scaleOf,
} from './helpers';
import { mulberry32 } from './prng';

/** All rank/kernel/image invariants for any m×n matrix. */
function expectSubspaceInvariants(a: Matrix): void {
  const r = rank(a);
  const ker = nullspace(a);
  const im = columnSpace(a);
  expect(r + ker.length).toBe(a.cols);
  expect(im.length).toBe(r);
  expectOrthonormal(ker);
  expectOrthonormal(im);
  for (const v of ker) expect(v.length).toBe(a.cols);
  for (const v of im) expect(v.length).toBe(a.rows);
  expectInKernel(a, ker, 10 * tolFor(a));
  // Every column of A lies in the image.
  for (let j = 0; j < a.cols; j++) {
    const col = Array.from({ length: a.rows }, (_, i) => a.data[i * a.cols + j]);
    expect(distanceToSpan(col, im)).toBeLessThan(10 * tolFor(a));
  }
}

describe('rref', () => {
  it('reduces to the textbook form', () => {
    const { r, pivots } = rref(
      fromRows([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ]),
    );
    expect(pivots).toEqual([0, 1]);
    const want = [1, 0, -1, 0, 1, 2, 0, 0, 0];
    want.forEach((x, k) => expect(r.data[k]).toBeCloseTo(x, 12));
  });

  it('rank([[0,1],[0,2]]) is 1 (old code returned 2)', () => {
    const a = fromRows([
      [0, 1],
      [0, 2],
    ]);
    expect(rank(a)).toBe(1);
    const [k] = nullspace(a);
    expect(Math.abs(k[0])).toBeCloseTo(1, 15);
    expect(k[1]).toBeCloseTo(0, 15);
    const [i] = columnSpace(a);
    expect(Math.abs(i[0])).toBeCloseTo(1 / Math.sqrt(5), 15);
    expect(Math.abs(i[1])).toBeCloseTo(2 / Math.sqrt(5), 15);
    expectSubspaceInvariants(a);
  });

  it('the zero matrix has rank 0, full kernel, empty image', () => {
    for (const [m, n] of [
      [1, 1],
      [2, 3],
      [3, 3],
    ]) {
      const z = matrix(m, n);
      expect(rank(z)).toBe(0);
      expect(nullspace(z)).toHaveLength(n);
      expect(columnSpace(z)).toHaveLength(0);
      expectSubspaceInvariants(z);
    }
  });

  it('singular 3×3 of rank 1 and rank 2', () => {
    const r1 = fromRows([
      [1, -2, 3],
      [-2, 4, -6],
      [0.5, -1, 1.5],
    ]);
    expect(rank(r1)).toBe(1);
    expectSubspaceInvariants(r1);
    const r2 = fromRows([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
    expect(rank(r2)).toBe(2);
    expectSubspaceInvariants(r2);
  });

  it('non-square 2×3 and 3×2', () => {
    const wide = fromRows([
      [1, 2, 3],
      [2, 4, 7],
    ]);
    expect(rank(wide)).toBe(2);
    expect(nullspace(wide)).toHaveLength(1);
    expect(columnSpace(wide)).toHaveLength(2);
    expectSubspaceInvariants(wide);

    const wideRank1 = fromRows([
      [1, 2, 3],
      [-2, -4, -6],
    ]);
    expect(rank(wideRank1)).toBe(1);
    expectSubspaceInvariants(wideRank1);

    const tall = fromRows([
      [1, 0],
      [0, 1],
      [1, 1],
    ]);
    expect(rank(tall)).toBe(2);
    expect(nullspace(tall)).toHaveLength(0);
    const im = columnSpace(tall);
    // The image is the plane x + y − z = 0.
    for (const v of im) expect(v[0] + v[1] - v[2]).toBeCloseTo(0, 14);
    expectSubspaceInvariants(tall);

    const tallRank1 = fromRows([
      [1, 2],
      [2, 4],
      [3, 6],
    ]);
    expect(rank(tallRank1)).toBe(1);
    expectSubspaceInvariants(tallRank1);
  });

  it('rank is invariant under scaling by large factors (relative tolerance)', () => {
    const a = fromRows([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
    for (const c of [1, 1e3, 1e8]) expect(rank(scale(a, c))).toBe(2);
  });

  it('random m×n matrices (seeded) satisfy rank–nullity and basis invariants', () => {
    const rng = mulberry32(21);
    for (let k = 0; k < 400; k++) {
      const m = 1 + Math.floor(rng() * 4);
      const n = 1 + Math.floor(rng() * 4);
      const a = randomMatrix(rng, m, n);
      expectSubspaceInvariants(a);
      expect(rank(a)).toBeLessThanOrEqual(Math.min(m, n));
      expect(scaleOf(a)).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('orthonormalize', () => {
  it('drops dependent vectors and orthonormalises the rest', () => {
    const q = orthonormalize([
      [1, 1, 0],
      [2, 2, 0],
      [1, 0, 0],
      [0, 0, 0],
      [3, 1, 0],
    ]);
    expect(q).toHaveLength(2);
    expectOrthonormal(q);
  });

  it('keeps nearly-parallel but independent vectors accurate (re-orthogonalisation)', () => {
    const q = orthonormalize([
      [1, 1e-7, 0],
      [1, 0, 1e-7],
      [1, 0, 0],
    ]);
    expect(q).toHaveLength(3);
    expectOrthonormal(q, 1e-12);
  });
});
