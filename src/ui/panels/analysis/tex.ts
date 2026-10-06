/** TeX assembled from core/format builders plus static TeX only (never user text). */
import type { Complex } from '../../../core/analysis';
import { complexToLatex, vectorToLatex } from '../../../core/format';
import type { Vec } from '../../../core/linalg/matrix';

export function spanTex(basis: readonly Vec[]): string {
  return `\\operatorname{span}\\left\\{ ${basis.map((v) => vectorToLatex(v, 2)).join(',\\, ')} \\right\\}`;
}

export function eigenvalueTex(index: number, value: Complex): string {
  return `\\lambda_{${index}} = ${complexToLatex(value, 3)}`;
}

export function isReal(z: Complex): boolean {
  return z.im === 0;
}
