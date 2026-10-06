import { describe, expect, it } from 'vitest';
import type { EigenResult, EigenSpace } from '../../src/core/analysis';
import { depressedCubicRoots, eigen } from '../../src/core/linalg/eigen';
import { inverse } from '../../src/core/linalg/lu';
import { fromRows, identity, matrix, type Matrix } from '../../src/core/linalg/matrix';
import { mul, scale, transpose } from '../../src/core/linalg/ops';
import { tolFor } from '../../src/core/tolerance';
import {
  eigenResidual,
  expectEigenInvariants,
  randomMatrix,
  randomRotation3,
  rotation2,
  rotation3,
} from './helpers';
import { mulberry32 } from './prng';

function analyzeEigen(m: Matrix): EigenResult {
  const e = eigen(m);
  expectEigenInvariants(m, e);
  return e;
}

function reals(e: EigenResult): number[] {
  return e.values.map((z) => {
    expect(z.im).toBe(0);
    return z.re;
  });
}

function spaceNear(e: EigenResult, value: number, tol = 1e-9): EigenSpace {
  const s = e.spaces.find((sp) => sp.value.im === 0 && Math.abs(sp.value.re - value) <= tol);
  if (!s) throw new Error(`no eigenspace near ${value}`);
  return s;
}

function diag(...d: number[]): Matrix {
  const m = matrix(d.length, d.length);
  d.forEach((x, i) => (m.data[i * d.length + i] = x));
  return m;
}

/** All permutations of an array. */
function permutations<T>(xs: readonly T[]): T[][] {
  if (xs.length <= 1) return [[...xs]];
  return xs.flatMap((x, i) =>
    permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [x, ...rest]),
  );
}

describe('eigen: diagonal matrices and the old sign bug', () => {
  it('diag(1,2,3) has eigenvalues 3, 2, 1 (old code gave −1, −3, −2)', () => {
    const e = analyzeEigen(diag(1, 2, 3));
    const v = reals(e);
    [3, 2, 1].forEach((x, i) => expect(v[i]).toBeCloseTo(x, 12));
    expect(e.defective).toBe(false);
  });

  it('every permutation of the diagonal gives the same descending spectrum', () => {
    for (const d of permutations([1, 2, 3])) {
      const v = reals(analyzeEigen(diag(...d)));
      [3, 2, 1].forEach((x, i) => expect(v[i]).toBeCloseTo(x, 12));
    }
    for (const d of permutations([-4, 0.5, 7])) {
      const v = reals(analyzeEigen(diag(...d)));
      [7, 0.5, -4].forEach((x, i) => expect(v[i]).toBeCloseTo(x, 12));
    }
  });

  it('a permutation similarity P·D·Pᵀ keeps the spectrum; eigenvectors are permuted axes', () => {
    const p = fromRows([
      [0, 0, 1],
      [1, 0, 0],
      [0, 1, 0],
    ]);
    const a = mul(mul(p, diag(1, 2, 3)), transpose(p));
    const e = analyzeEigen(a);
    [3, 2, 1].forEach((x, i) => expect(e.values[i].re).toBeCloseTo(x, 12));
  });

  it('1×1 and 2×2 diagonal', () => {
    expect(reals(analyzeEigen(diag(-2.5)))).toEqual([-2.5]);
    const v = reals(analyzeEigen(diag(-1, 4)));
    expect(v).toEqual([4, -1]);
  });
});

describe('eigen: rotations', () => {
  it('2D ±90° has eigenvalues ±i, +i first', () => {
    for (const angle of [Math.PI / 2, -Math.PI / 2]) {
      const e = analyzeEigen(rotation2(angle));
      expect(e.values[0].re).toBeCloseTo(0, 15);
      expect(e.values[0].im).toBeCloseTo(1, 15);
      expect(e.values[1]).toEqual({ re: e.values[0].re, im: -e.values[0].im });
      expect(e.spaces.map((s) => s.geometricMultiplicity)).toEqual([0, 0]);
    }
  });

  it('2D 45° has eigenvalues (1 ± i)/√2', () => {
    const e = analyzeEigen(rotation2(Math.PI / 4));
    expect(e.values[0].re).toBeCloseTo(Math.SQRT1_2, 14);
    expect(e.values[0].im).toBeCloseTo(Math.SQRT1_2, 14);
  });

  it('3D rotation about z: eigenvalue 1 with axis e3, then cos θ ± i sin θ', () => {
    const theta = 0.7;
    const e = analyzeEigen(rotation3([0, 0, 1], theta));
    expect(e.values[0].re).toBeCloseTo(1, 12);
    expect(e.values[0].im).toBe(0);
    expect(e.values[1].re).toBeCloseTo(Math.cos(theta), 12);
    expect(e.values[1].im).toBeCloseTo(Math.sin(theta), 12);
    const axis = e.spaces[0].basis[0];
    expect(Math.abs(axis[2])).toBeCloseTo(1, 12);
  });

  it('3D rotation about (1,1,1): the axis is the real eigenvector', () => {
    for (const theta of [(2 * Math.PI) / 3, 0.3, -2]) {
      const e = analyzeEigen(rotation3([1, 1, 1], theta));
      const axis = spaceNear(e, 1).basis[0];
      for (const c of axis) expect(c).toBeCloseTo(1 / Math.sqrt(3), 10);
    }
  });

  it('3D half-turn has a real double eigenvalue −1 with a 2-D eigenspace', () => {
    const e = analyzeEigen(rotation3([1, 2, 2], Math.PI));
    const minusOne = spaceNear(e, -1, 1e-6);
    expect(minusOne.algebraicMultiplicity).toBe(2);
    expect(minusOne.geometricMultiplicity).toBe(2);
  });
});

describe('eigen: repeated and defective eigenvalues', () => {
  it('2×2 shear is defective: algebraic 2, geometric 1, eigenvector e1', () => {
    const e = analyzeEigen(
      fromRows([
        [1, 1],
        [0, 1],
      ]),
    );
    expect(e.spaces).toHaveLength(1);
    expect(e.spaces[0].algebraicMultiplicity).toBe(2);
    expect(e.spaces[0].geometricMultiplicity).toBe(1);
    expect(e.defective).toBe(true);
    expect(Math.abs(e.spaces[0].basis[0][0])).toBeCloseTo(1, 12);
  });

  it('3×3 shear in the xy-plane: λ = 1 with algebraic 3, geometric 2', () => {
    const e = analyzeEigen(
      fromRows([
        [1, 1, 0],
        [0, 1, 0],
        [0, 0, 1],
      ]),
    );
    expect(e.spaces[0].algebraicMultiplicity).toBe(3);
    expect(e.spaces[0].geometricMultiplicity).toBe(2);
    expect(e.defective).toBe(true);
  });

  it('[[2,1,0],[0,2,0],[0,0,2]]: algebraic 3, geometric 2', () => {
    const e = analyzeEigen(
      fromRows([
        [2, 1, 0],
        [0, 2, 0],
        [0, 0, 2],
      ]),
    );
    expect(e.spaces).toHaveLength(1);
    expect(e.spaces[0].value.re).toBeCloseTo(2, 12);
    expect(e.spaces[0].algebraicMultiplicity).toBe(3);
    expect(e.spaces[0].geometricMultiplicity).toBe(2);
    expect(e.defective).toBe(true);
  });

  it('a 3×3 Jordan block: algebraic 3, geometric 1', () => {
    const e = analyzeEigen(
      fromRows([
        [2, 1, 0],
        [0, 2, 1],
        [0, 0, 2],
      ]),
    );
    expect(e.spaces[0].algebraicMultiplicity).toBe(3);
    expect(e.spaces[0].geometricMultiplicity).toBe(1);
  });

  it('c·I has one eigenvalue with geometric multiplicity n', () => {
    for (const [n, c] of [
      [1, 3],
      [2, -1.5],
      [3, 2],
      [3, 0],
    ]) {
      const e = analyzeEigen(scale(identity(n), c));
      expect(e.spaces).toHaveLength(1);
      expect(e.spaces[0].value.re).toBe(c);
      expect(e.spaces[0].algebraicMultiplicity).toBe(n);
      expect(e.spaces[0].geometricMultiplicity).toBe(n);
      expect(e.defective).toBe(false);
    }
  });

  it('a shear conjugated by a non-orthogonal basis change stays defective', () => {
    const s = fromRows([
      [2, 1],
      [1, 3],
    ]);
    const shear = fromRows([
      [3, 1],
      [0, 3],
    ]);
    const a = mul(mul(s, shear), inverse(s));
    const e = analyzeEigen(a);
    expect(e.spaces).toHaveLength(1);
    expect(e.spaces[0].geometricMultiplicity).toBe(1);
    expect(e.defective).toBe(true);
  });

  it('Q·diag(1,1,2)·Qᵀ keeps a 2-D eigenspace for λ = 1 after rounding', () => {
    const rng = mulberry32(7);
    for (let k = 0; k < 20; k++) {
      const q = randomRotation3(rng);
      const e = analyzeEigen(mul(mul(q, diag(1, 1, 2)), transpose(q)));
      const one = spaceNear(e, 1, 1e-6);
      expect(one.algebraicMultiplicity).toBe(2);
      expect(one.geometricMultiplicity).toBe(2);
      expect(e.defective).toBe(false);
    }
  });
});

describe('eigen: singular matrices', () => {
  it('rank-1 3×3 (u·vᵀ): λ = 0 twice with a 2-D eigenspace, and λ = vᵀu', () => {
    const u = [1, 2, -1];
    const v = [3, 0, 1];
    const a = matrix(3, 3);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) a.data[i * 3 + j] = u[i] * v[j];
    const e = analyzeEigen(a);
    const zero = spaceNear(e, 0, 1e-6);
    expect(zero.algebraicMultiplicity).toBe(2);
    expect(zero.geometricMultiplicity).toBe(2);
    expect(spaceNear(e, 2).algebraicMultiplicity).toBe(1);
  });

  it('rank-2 3×3 has a simple eigenvalue 0 whose eigenvector spans the kernel', () => {
    const a = fromRows([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
    const e = analyzeEigen(a);
    const zero = spaceNear(e, 0, 1e-9);
    expect(zero.geometricMultiplicity).toBe(1);
    const k = zero.basis[0];
    expect(Math.abs(k[0])).toBeCloseTo(1 / Math.sqrt(6), 10);
  });

  it('the zero matrix: λ = 0 with full eigenspace', () => {
    for (const n of [1, 2, 3]) {
      const e = analyzeEigen(matrix(n, n));
      expect(e.spaces).toHaveLength(1);
      expect(e.spaces[0].geometricMultiplicity).toBe(n);
    }
  });
});

describe('eigen: near-repeated roots and the eigenspace tolerance', () => {
  it('diag(1, 1+1e-9, 2) clusters into one eigenvalue of multiplicity 2', () => {
    const e = analyzeEigen(diag(1, 1 + 1e-9, 2));
    expect(e.spaces).toHaveLength(2);
    const one = spaceNear(e, 1, 1e-8);
    expect(one.algebraicMultiplicity).toBe(2);
    expect(one.geometricMultiplicity).toBe(2);
    expect(e.defective).toBe(false);
  });

  it('diag(1, 1+1e-7, 2) needs the cluster-spread term (5e-8 ≫ tolFor) to stay non-defective', () => {
    const a = diag(1, 1 + 1e-7, 2);
    const e = analyzeEigen(a);
    const one = spaceNear(e, 1 + 5e-8, 1e-12);
    // σ(A − λ̂I) = 5e-8 twice, far above tolFor(A); the spread term is what accepts both.
    expect(5e-8).toBeGreaterThan(10 * tolFor(a));
    expect(one.geometricMultiplicity).toBe(2);
    for (const v of one.basis) expect(eigenResidual(a, one.value.re, v)).toBeLessThan(1e-7);
  });

  it('diag(1, 1+1e-5, 2) is NOT clustered (gap above eigenClusterTolFor)', () => {
    const e = analyzeEigen(diag(1, 1 + 1e-5, 2));
    expect(e.spaces).toHaveLength(3);
  });

  it('a conjugate pair closer than the cluster tolerance snaps to a real double root', () => {
    const e = analyzeEigen(
      fromRows([
        [1, 1e-8],
        [-1e-8, 1],
      ]),
    );
    expect(e.values.every((z) => z.im === 0)).toBe(true);
    expect(e.spaces[0].algebraicMultiplicity).toBe(2);
    expect(e.spaces[0].geometricMultiplicity).toBe(2);
  });

  it('eigen(c·A) = c·eigen(A) for large and small c (relative tolerances)', () => {
    const a = fromRows([
      [2, 1, 0],
      [1, 3, 1],
      [0, 1, 4],
    ]);
    const base = analyzeEigen(a).values;
    for (const c of [1e-6, 1e6]) {
      const e = analyzeEigen(scale(a, c));
      e.values.forEach((z, i) => expect(z.re / c).toBeCloseTo(base[i].re, 9));
    }
  });
});

describe('eigen: triple roots in a rotated basis (numerically nilpotent shift)', () => {
  /** Distinct outcomes ("r|c alg/geo" per space) over 500 seeded random rotations Q·D·Qᵀ. */
  function rotatedOutcomes(d: readonly number[], seed: number): Set<string> {
    const rng = mulberry32(seed);
    const seen = new Set<string>();
    for (let k = 0; k < 500; k++) {
      const q = randomRotation3(rng);
      const a = mul(mul(q, matrix(3, 3, d)), transpose(q));
      const e = analyzeEigen(a);
      seen.add(
        e.spaces
          .map(
            (s) => `${s.value.im ? 'c' : 'r'}${s.algebraicMultiplicity}/${s.geometricMultiplicity}`,
          )
          .join(' '),
      );
    }
    return seen;
  }

  it('rotated 3×3 Jordan block: one λ with algebraic 3, geometric 1 (all 500)', () => {
    expect(rotatedOutcomes([2, 1, 0, 0, 2, 1, 0, 0, 2], 5)).toEqual(new Set(['r3/1']));
    expect(rotatedOutcomes([-700, 3, 0, 0, -700, 0.5, 0, 0, -700], 6)).toEqual(new Set(['r3/1']));
    expect(rotatedOutcomes([0, 1e-3, 0, 0, 0, 1e-3, 0, 0, 0], 7)).toEqual(new Set(['r3/1']));
  });

  it('rotated [[2,1,0],[0,2,0],[0,0,2]] and rotated 2I are unchanged', () => {
    expect(rotatedOutcomes([2, 1, 0, 0, 2, 0, 0, 0, 2], 8)).toEqual(new Set(['r3/2']));
    expect(rotatedOutcomes([2, 0, 0, 0, 2, 0, 0, 0, 2], 9)).toEqual(new Set(['r3/3']));
  });

  it('eigenspace uses the backward-error spread, not ε^{1/3}: a 1e-6 superdiagonal still gives geometric 1', () => {
    const d = [2, 1, 0, 0, 2, 1e-6, 0, 0, 2];
    expect(rotatedOutcomes(d, 10)).toEqual(new Set(['r3/1']));
    const e = analyzeEigen(matrix(3, 3, d));
    expect(e.spaces.map((s) => s.geometricMultiplicity)).toEqual([1]);
  });

  it('a genuine near-triple with distinct roots is NOT merged: diag(1, 1+1e-4, 1−1e-4)', () => {
    const d = [1, 0, 0, 0, 1 + 1e-4, 0, 0, 0, 1 - 1e-4];
    const e = analyzeEigen(matrix(3, 3, d));
    expect(e.spaces).toHaveLength(3);
    [1 + 1e-4, 1, 1 - 1e-4].forEach((x, i) => expect(e.values[i].re).toBeCloseTo(x, 12));
    expect(rotatedOutcomes(d, 11)).toEqual(new Set(['r1/1 r1/1 r1/1']));
  });

  it('a non-orthogonal similarity of a Jordan block is still detected', () => {
    const s = fromRows([
      [2, 1, 0],
      [1, 3, 1],
      [0, 1, 1],
    ]);
    const j = fromRows([
      [5, 1, 0],
      [0, 5, 1],
      [0, 0, 5],
    ]);
    const e = analyzeEigen(mul(mul(s, j), inverse(s)));
    expect(e.spaces).toHaveLength(1);
    expect(e.spaces[0].value.re).toBeCloseTo(5, 12);
    expect(e.spaces[0].algebraicMultiplicity).toBe(3);
    expect(e.spaces[0].geometricMultiplicity).toBe(1);
  });
});

describe('eigen: depressed cubic', () => {
  it('μ³ − 3μ + 2 = (μ − 1)²(μ + 2)', () => {
    const r = depressedCubicRoots(-3, 2).reals.sort((x, y) => x - y);
    expect(r[0]).toBeCloseTo(-2, 12);
    expect(r[1]).toBeCloseTo(1, 7);
    expect(r[2]).toBeCloseTo(1, 7);
  });

  it('μ³ + μ = μ(μ² + 1) gives 0 and ±i as an exact conjugate pair', () => {
    const r = depressedCubicRoots(1, 0);
    expect(r.reals).toEqual([0]);
    expect(r.pairs[0].re).toBeCloseTo(0, 15);
    expect(r.pairs[0].im).toBeCloseTo(1, 15);
  });
});

describe('eigen: contract limits', () => {
  it('throws a RangeError for n > 3 and for non-square input', () => {
    expect(() => eigen(identity(4))).toThrow(RangeError);
    expect(() => eigen(matrix(2, 3))).toThrow(RangeError);
  });
});

/**
 * Exact multiplicities of the repeated eigenvalues of a small-integer matrix, computed without
 * floating-point error. The characteristic polynomial is monic with integer coefficients, so a
 * repeated root of a cubic is an integer, and of a quadratic, an integer or a half-integer.
 * All quantities below are small integers or halves, which doubles represent exactly.
 */
function exactRepeated(a: Matrix): { value: number; algebraic: number; geometric: number }[] {
  const n = a.rows;
  const x = (i: number, j: number) => a.data[i * n + j];
  const tr = Array.from({ length: n }, (_, i) => x(i, i)).reduce((s, v) => s + v, 0);
  const minors2 = (m: (i: number, j: number) => number) => {
    let s = 0;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) s += m(i, i) * m(j, j) - m(i, j) * m(j, i);
    return s;
  };
  // p(λ) = det(λI − A) and its derivatives, as polynomials with exact integer coefficients.
  const c1 = minors2(x);
  const dt = n === 2 ? c1 : det3(x);
  const p = (l: number) => (n === 2 ? l * l - tr * l + dt : l ** 3 - tr * l * l + c1 * l - dt);
  const dp = (l: number) => (n === 2 ? 2 * l - tr : 3 * l * l - 2 * tr * l + c1);
  const ddp = (l: number) => (n === 2 ? 2 : 6 * l - 2 * tr);
  const out = [];
  for (let k = -60; k <= 60; k++) {
    const l = k / 2;
    if (p(l) !== 0 || dp(l) !== 0) continue;
    const algebraic = n === 3 && ddp(l) === 0 ? 3 : 2;
    // rank of 2(A − λI), which has integer entries.
    const b = (i: number, j: number) => 2 * x(i, j) - (i === j ? 2 * l : 0);
    out.push({ value: l, algebraic, geometric: n - exactRank(b, n) });
  }
  return out;
}

function det3(m: (i: number, j: number) => number): number {
  return (
    m(0, 0) * (m(1, 1) * m(2, 2) - m(1, 2) * m(2, 1)) -
    m(0, 1) * (m(1, 0) * m(2, 2) - m(1, 2) * m(2, 0)) +
    m(0, 2) * (m(1, 0) * m(2, 1) - m(1, 1) * m(2, 0))
  );
}

/** Rank from exact minors: the largest k with a non-zero k×k minor (n ≤ 3). */
function exactRank(m: (i: number, j: number) => number, n: number): number {
  if (n === 3 && det3(m) !== 0) return 3;
  for (let i = 0; i < n; i++)
    for (let k = i + 1; k < n; k++)
      for (let j = 0; j < n; j++)
        for (let l = j + 1; l < n; l++) if (m(i, j) * m(k, l) - m(i, l) * m(k, j) !== 0) return 2;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (m(i, j) !== 0) return 1;
  return 0;
}

describe('eigen: exact cross-check on integer matrices', () => {
  for (const n of [2, 3]) {
    it(`1000 random integer ${n}×${n}: multiplicities match exact integer arithmetic`, () => {
      const rng = mulberry32(500 + n);
      let repeatedSeen = 0;
      let defectiveSeen = 0;
      for (let t = 0; t < 1000; t++) {
        const a = matrix(n, n);
        for (let k = 0; k < a.data.length; k++) a.data[k] = Math.floor(rng() * 5) - 2;
        const e = eigen(a);
        const exact = exactRepeated(a);
        let merged = 0;
        for (const r of exact) {
          const s = spaceNear(e, r.value, 1e-6);
          expect(s.algebraicMultiplicity).toBe(r.algebraic);
          expect(s.geometricMultiplicity).toBe(r.geometric);
          merged += r.algebraic - 1;
          repeatedSeen++;
          if (r.geometric < r.algebraic) defectiveSeen++;
        }
        // Simple roots of small integer polynomials are well separated: none may be merged.
        expect(e.spaces.length).toBe(n - merged);
      }
      expect(repeatedSeen).toBeGreaterThan(20);
      expect(defectiveSeen).toBeGreaterThan(5);
    });
  }
});

describe('eigen: seeded random matrices', () => {
  for (const n of [2, 3]) {
    it(`200 random ${n}×${n} matrices satisfy every invariant`, () => {
      const rng = mulberry32(1000 + n);
      for (let k = 0; k < 200; k++) analyzeEigen(randomMatrix(rng, n, n));
    });
  }

  it('200 random symmetric 3×3 matrices have real spectra with full eigenspaces', () => {
    const rng = mulberry32(42);
    for (let k = 0; k < 200; k++) {
      const b = randomMatrix(rng, 3, 3);
      const s = mul(b, transpose(b));
      const e = analyzeEigen(s);
      expect(e.values.every((z) => z.im === 0)).toBe(true);
      expect(e.defective).toBe(false);
    }
  });
});
