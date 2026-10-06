import { describe, expect, it } from 'vitest';
import { fromRows, identity, toRows } from '../../src/core/linalg/matrix';
import { apply, mul } from '../../src/core/linalg/ops';

describe('matrix basics', () => {
  it('round-trips rows', () => {
    expect(
      toRows(
        fromRows([
          [1, 2, 3],
          [4, 5, 6],
        ]),
      ),
    ).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
  });
  it('multiplies non-square', () => {
    const a = fromRows([
      [1, 2, 3],
      [4, 5, 6],
    ]); // 2×3
    const b = fromRows([[1], [0], [-1]]); // 3×1
    expect(toRows(mul(a, b))).toEqual([[-2], [-2]]);
  });
  it('identity acts trivially', () => {
    expect(Array.from(apply(identity(3), [1, -2, 3]))).toEqual([1, -2, 3]);
  });
});
