/**
 * FROZEN CONTRACT (signatures) — number formatting and KaTeX source builders.
 * Output is plain strings; rendering with KaTeX happens in ui/.
 *
 * STUB (head agent): simple implementations. Math agent hardens them (−0, tiny values,
 * true minus sign U+2212 in plain text, consistent significant digits) and tests them.
 */
import type { Complex } from './analysis';
import type { Matrix } from './linalg/matrix';

/** Plain-text number: at most `digits` decimals, trailing zeros trimmed, −0 → 0, |x|<tiny → 0. */
export function formatNumber(x: number, digits = 3): string {
  if (!Number.isFinite(x)) return String(x);
  const r = Number(x.toFixed(digits));
  if (r === 0) return '0';
  return String(r).replace('-', '−');
}

/** Plain-text complex: "a", "bi", "a + bi", "a − bi". */
export function formatComplex(z: Complex, digits = 3): string {
  if (Number(z.im.toFixed(digits)) === 0) return formatNumber(z.re, digits);
  const im = `${formatNumber(Math.abs(z.im), digits)}i`;
  if (Number(z.re.toFixed(digits)) === 0) return z.im < 0 ? `−${im}` : im;
  return `${formatNumber(z.re, digits)} ${z.im < 0 ? '−' : '+'} ${im}`;
}

/** KaTeX number (uses ASCII '-'). */
export function numberToLatex(x: number, digits = 3): string {
  return formatNumber(x, digits).replace('−', '-');
}

export function complexToLatex(z: Complex, digits = 3): string {
  return formatComplex(z, digits).replace(/−/g, '-');
}

/** \begin{bmatrix} … \end{bmatrix} */
export function matrixToLatex(m: Matrix, digits = 2): string {
  const rows: string[] = [];
  for (let i = 0; i < m.rows; i++) {
    const cells: string[] = [];
    for (let j = 0; j < m.cols; j++) cells.push(numberToLatex(m.data[i * m.cols + j], digits));
    rows.push(cells.join(' & '));
  }
  return `\\begin{bmatrix} ${rows.join(' \\\\ ')} \\end{bmatrix}`;
}

/** Column vector as bmatrix. */
export function vectorToLatex(v: ArrayLike<number>, digits = 2): string {
  const parts: string[] = [];
  for (let i = 0; i < v.length; i++) parts.push(numberToLatex(v[i], digits));
  return `\\begin{bmatrix} ${parts.join(' \\\\ ')} \\end{bmatrix}`;
}
