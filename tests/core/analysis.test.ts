import { describe, expect, it } from 'vitest';
import { analyze } from '../../src/core/analysis';
import { det, inverse } from '../../src/core/linalg/lu';
import { fromRows, identity, matrix } from '../../src/core/linalg/matrix';
import { trace } from '../../src/core/linalg/ops';
import { tolFor } from '../../src/core/tolerance';
import {
  distanceToSpan,
  expectEigenInvariants,
  expectInKernel,
  expectOrthonormal,
  randomMatrix,
} from './helpers';
import { mulberry32 } from './prng';

describe('analyze', () => {
  it('non-square 2×3: rank, kernel, image; no square-only fields', () => {
    const a = fromRows([
      [1, 0, 2],
      [0, 1, 3],
    ]);
    const r = analyze(a);
    expect(r.square).toBe(false);
    expect(r.shape).toEqual({ rows: 2, cols: 3 });
    expect(r.rank).toBe(2);
    expect(r.nullity).toBe(1);
    expect(r.kernelBasis).toHaveLength(1);
    expect(r.imageBasis).toHaveLength(2);
    expectInKernel(a, r.kernelBasis, 1e-12);
    for (const key of ['trace', 'det', 'invertible', 'orientation', 'eigen'] as const) {
      expect(r[key]).toBeUndefined();
    }
  });

  it('non-square 3×2 of rank 1', () => {
    const r = analyze(
      fromRows([
        [1, -1],
        [2, -2],
        [0, 0],
      ]),
    );
    expect(r.rank).toBe(1);
    expect(r.nullity).toBe(1);
    expect(distanceToSpan([1, 2, 0], r.imageBasis)).toBeLessThan(1e-12);
  });

  it('[[0,1],[0,2]]: rank 1, degenerate, not invertible', () => {
    const r = analyze(
      fromRows([
        [0, 1],
        [0, 2],
      ]),
    );
    expect(r.rank).toBe(1);
    expect(r.invertible).toBe(false);
    expect(r.orientation).toBe('degenerate');
    expect(r.det).toBe(0);
  });

  it('orientation follows the sign of det for invertible matrices', () => {
    expect(analyze(identity(3)).orientation).toBe('preserving');
    expect(
      analyze(
        fromRows([
          [0, 1],
          [1, 0],
        ]),
      ).orientation,
    ).toBe('reversing');
    expect(analyze(matrix(3, 3)).orientation).toBe('degenerate');
  });

  it('4×4: square fields present, eigen deliberately undefined (v1 limit)', () => {
    const r = analyze(identity(4));
    expect(r.det).toBe(1);
    expect(r.trace).toBe(4);
    expect(r.invertible).toBe(true);
    expect(r.eigen).toBeUndefined();
  });

  it('random matrices (seeded): all fields are mutually consistent', () => {
    const rng = mulberry32(31);
    for (let k = 0; k < 300; k++) {
      const rows = 1 + (k % 3);
      const cols = k % 2 === 0 ? rows : 1 + Math.floor(rng() * 3);
      const a = randomMatrix(rng, rows, cols);
      const r = analyze(a);
      expect(r.rank + r.nullity).toBe(cols);
      expect(r.kernelBasis).toHaveLength(r.nullity);
      expect(r.imageBasis).toHaveLength(r.rank);
      expectOrthonormal(r.kernelBasis);
      expectOrthonormal(r.imageBasis);
      expectInKernel(a, r.kernelBasis, 10 * tolFor(a));
      if (!r.square) continue;
      expect(r.trace).toBe(trace(a));
      expect(r.det).toBe(det(a));
      expect(r.invertible).toBe(r.rank === rows);
      if (r.invertible) expect(() => inverse(a)).not.toThrow();
      else expect(() => inverse(a)).toThrow(RangeError);
      const e = r.eigen;
      if (!e) throw new Error('eigen missing for n ≤ 3');
      expectEigenInvariants(a, e);
    }
  });
});
