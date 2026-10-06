import { formatNumber } from '../../core/format';

const SUB = '₀₁₂₃₄₅₆₇₈₉';

/** "12" → "₁₂" */
export function subscript(n: number | string): string {
  return String(n).replace(/\d/g, (d) => SUB[Number(d)]);
}

/** Plain-text tuple "(1, −0.5)". */
export function formatTuple(values: ArrayLike<number>, digits = 2): string {
  return `(${Array.from(values, (x) => formatNumber(x, digits)).join(', ')})`;
}

/** Index range [0, n). */
export function range(n: number): number[] {
  return Array.from({ length: n }, (_, k) => k);
}
