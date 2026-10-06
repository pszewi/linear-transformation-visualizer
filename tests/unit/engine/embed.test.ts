import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { fromRows } from '../../../src/core/linalg/matrix';
import { apply } from '../../../src/core/linalg/ops';
import { applyPadded, columnPadded, embedMatrix4, padTo3 } from '../../../src/engine/embed';

function image(m4: Matrix4, x: number, y: number, z: number): number[] {
  return new Vector3(x, y, z).applyMatrix4(m4).toArray();
}

describe('embedMatrix4', () => {
  it('puts a 2×2 map top-left and passes z through (depth layering in 2D)', () => {
    const m4 = embedMatrix4(
      fromRows([
        [1, 2],
        [3, 4],
      ]),
      new Matrix4(),
    );
    expect(image(m4, 1, 0, 0)).toEqual([1, 3, 0]);
    expect(image(m4, 0, 1, 0)).toEqual([2, 4, 0]);
    expect(image(m4, 0, 0, 1)).toEqual([0, 0, 1]);
  });

  it('agrees with A·v for a 3×3 map', () => {
    const a = fromRows([
      [1, 2, 3],
      [0, -1, 4],
      [5, 0.5, 2],
    ]);
    const m4 = embedMatrix4(a, new Matrix4());
    const v = [0.3, -2, 1.5];
    const got = image(m4, v[0], v[1], v[2]);
    const want = Array.from(apply(a, v));
    got.forEach((x, i) => expect(x).toBeCloseTo(want[i], 12));
  });

  it('zero-pads non-square shapes (3×2 and 2×3) without a pass-through axis', () => {
    const tall = embedMatrix4(
      fromRows([
        [1, 0],
        [0, 1],
        [2, 3],
      ]),
      new Matrix4(),
    );
    expect(image(tall, 1, 1, 7)).toEqual([1, 1, 5]); // domain z ignored
    const wide = embedMatrix4(
      fromRows([
        [1, 0, 2],
        [0, 1, 3],
      ]),
      new Matrix4(),
    );
    expect(image(wide, 1, 1, 1)).toEqual([3, 4, 0]); // lands in the xy-plane
  });

  it('keeps the homogeneous row/column', () => {
    const e = embedMatrix4(
      fromRows([
        [2, 0],
        [0, 2],
      ]),
      new Matrix4(),
    ).elements;
    expect([e[3], e[7], e[11], e[12], e[13], e[14], e[15]]).toEqual([0, 0, 0, 0, 0, 0, 1]);
  });
});

describe('padding helpers', () => {
  it('applyPadded tolerates domain vectors of the wrong length', () => {
    const a = fromRows([
      [1, 2],
      [3, 4],
    ]);
    const out = new Float64Array(3);
    expect(Array.from(applyPadded(a, [1], out))).toEqual([1, 3, 0]);
    expect(Array.from(applyPadded(a, [1, 1, 9], out))).toEqual([3, 7, 0]);
  });

  it('padTo3 and columnPadded zero-fill', () => {
    const out = new Float64Array(3);
    expect(Array.from(padTo3([5, 6, 7], 2, out))).toEqual([5, 6, 0]);
    const a = fromRows([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
    expect(Array.from(columnPadded(a, 1, out))).toEqual([2, 4, 6]);
    expect(Array.from(columnPadded(a, 2, out))).toEqual([0, 0, 0]);
  });
});
