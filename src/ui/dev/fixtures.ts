/**
 * Hand-written Analysis fixtures covering every presentation case (complex, repeated,
 * defective, 2-dim eigenspace, singular, non-square). Dev-only: used by FixtureGallery.
 */
import type { Analysis, Complex, EigenSpace } from '../../core/analysis';
import { vec } from '../../core/linalg/matrix';

export interface AnalysisFixture {
  readonly name: string;
  readonly rows: number[][];
  readonly analysis: Analysis;
}

const r = (re: number): Complex => ({ re, im: 0 });
const c = (re: number, im: number): Complex => ({ re, im });
const s5 = Math.sqrt(5);

function space(value: Complex, alg: number, basis: number[][]): EigenSpace {
  return {
    value,
    algebraicMultiplicity: alg,
    geometricMultiplicity: value.im === 0 ? basis.length : 0,
    basis: basis.map((b) => vec(b)),
  };
}

export const FIXTURES: readonly AnalysisFixture[] = [
  {
    name: 'Spiral — complex pair',
    rows: [
      [1, -1],
      [1, 1],
    ],
    analysis: {
      shape: { rows: 2, cols: 2 },
      square: true,
      rank: 2,
      nullity: 0,
      kernelBasis: [],
      imageBasis: [vec([1, 0]), vec([0, 1])],
      trace: 2,
      det: 2,
      invertible: true,
      orientation: 'preserving',
      eigen: {
        values: [c(1, 1), c(1, -1)],
        spaces: [space(c(1, 1), 1, []), space(c(1, -1), 1, [])],
        defective: false,
      },
    },
  },
  {
    name: 'Shear — defective',
    rows: [
      [1, 1],
      [0, 1],
    ],
    analysis: {
      shape: { rows: 2, cols: 2 },
      square: true,
      rank: 2,
      nullity: 0,
      kernelBasis: [],
      imageBasis: [vec([1, 0]), vec([0, 1])],
      trace: 2,
      det: 1,
      invertible: true,
      orientation: 'preserving',
      eigen: { values: [r(1), r(1)], spaces: [space(r(1), 2, [[1, 0]])], defective: true },
    },
  },
  {
    name: 'Reflection',
    rows: [
      [1, 0],
      [0, -1],
    ],
    analysis: {
      shape: { rows: 2, cols: 2 },
      square: true,
      rank: 2,
      nullity: 0,
      kernelBasis: [],
      imageBasis: [vec([1, 0]), vec([0, 1])],
      trace: 0,
      det: -1,
      invertible: true,
      orientation: 'reversing',
      eigen: {
        values: [r(1), r(-1)],
        spaces: [space(r(1), 1, [[1, 0]]), space(r(-1), 1, [[0, 1]])],
        defective: false,
      },
    },
  },
  {
    name: 'Singular rank 1',
    rows: [
      [1, 2],
      [2, 4],
    ],
    analysis: {
      shape: { rows: 2, cols: 2 },
      square: true,
      rank: 1,
      nullity: 1,
      kernelBasis: [vec([-2 / s5, 1 / s5])],
      imageBasis: [vec([1 / s5, 2 / s5])],
      trace: 5,
      det: 0,
      invertible: false,
      orientation: 'degenerate',
      eigen: {
        values: [r(5), r(0)],
        spaces: [space(r(5), 1, [[1 / s5, 2 / s5]]), space(r(0), 1, [[-2 / s5, 1 / s5]])],
        defective: false,
      },
    },
  },
  {
    name: '3D defective — λ = 2 (alg 3, geo 2)',
    rows: [
      [2, 1, 0],
      [0, 2, 0],
      [0, 0, 2],
    ],
    analysis: {
      shape: { rows: 3, cols: 3 },
      square: true,
      rank: 3,
      nullity: 0,
      kernelBasis: [],
      imageBasis: [vec([1, 0, 0]), vec([0, 1, 0]), vec([0, 0, 1])],
      trace: 6,
      det: 8,
      invertible: true,
      orientation: 'preserving',
      eigen: {
        values: [r(2), r(2), r(2)],
        spaces: [
          space(r(2), 3, [
            [1, 0, 0],
            [0, 0, 1],
          ]),
        ],
        defective: true,
      },
    },
  },
  {
    name: 'Rotate z 90° — 1, ±i',
    rows: [
      [0, -1, 0],
      [1, 0, 0],
      [0, 0, 1],
    ],
    analysis: {
      shape: { rows: 3, cols: 3 },
      square: true,
      rank: 3,
      nullity: 0,
      kernelBasis: [],
      imageBasis: [vec([1, 0, 0]), vec([0, 1, 0]), vec([0, 0, 1])],
      trace: 1,
      det: 1,
      invertible: true,
      orientation: 'preserving',
      eigen: {
        values: [r(1), c(0, 1), c(0, -1)],
        spaces: [space(r(1), 1, [[0, 0, 1]]), space(c(0, 1), 1, []), space(c(0, -1), 1, [])],
        defective: false,
      },
    },
  },
  {
    name: 'Project onto xy — 2-dim eigenspace',
    rows: [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 0],
    ],
    analysis: {
      shape: { rows: 3, cols: 3 },
      square: true,
      rank: 2,
      nullity: 1,
      kernelBasis: [vec([0, 0, 1])],
      imageBasis: [vec([1, 0, 0]), vec([0, 1, 0])],
      trace: 2,
      det: 0,
      invertible: false,
      orientation: 'degenerate',
      eigen: {
        values: [r(1), r(1), r(0)],
        spaces: [
          space(r(1), 2, [
            [1, 0, 0],
            [0, 1, 0],
          ]),
          space(r(0), 1, [[0, 0, 1]]),
        ],
        defective: false,
      },
    },
  },
  {
    name: 'Non-square 2×3',
    rows: [
      [1, 0, 2],
      [0, 1, 0],
    ],
    analysis: {
      shape: { rows: 2, cols: 3 },
      square: false,
      rank: 2,
      nullity: 1,
      kernelBasis: [vec([-2 / s5, 0, 1 / s5])],
      imageBasis: [vec([1, 0]), vec([0, 1])],
    },
  },
];
