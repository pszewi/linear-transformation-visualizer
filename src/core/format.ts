/**
 * FROZEN CONTRACT (signatures): number formatting and KaTeX source builders.
 * Output is plain strings. Rendering with KaTeX happens in ui/.
 *
 * Plain text uses the true minus sign U+2212 ("−"); LaTeX uses ASCII '-'. Values are shown with
 * at most `digits` decimals and trailing zeros trimmed. A value with |x| < 10^−digits shows as
 * "0" (so −0 and tiny rounding noise never show up as "−0" or "0.000"). NaN shows as "NaN" and
 * ±Infinity as "∞" / "−∞" (LaTeX: \text{NaN}, \infty).
 */
import type { Complex } from './analysis';
import type { Matrix } from './linalg/matrix';

const MINUS = '−';

/** Magnitudes from here on are shown in exponent form (toFixed switches to it at 1e21). */
const EXPONENT_FROM = 1e21;

/** Largest number of decimals honoured (toFixed accepts up to 100; beyond 20 is noise). */
const MAX_DIGITS = 20;

/** A finite number split into sign and unsigned decimal text, or a special value. */
type Parts =
  | { readonly kind: 'zero' }
  | { readonly kind: 'nan' }
  | { readonly kind: 'inf'; readonly negative: boolean }
  | { readonly kind: 'fixed'; readonly negative: boolean; readonly body: string }
  | {
      readonly kind: 'exp';
      readonly negative: boolean;
      readonly mantissa: string;
      readonly exponent: number;
    };

function clampDigits(digits: number): number {
  return Number.isFinite(digits) ? Math.min(MAX_DIGITS, Math.max(0, Math.trunc(digits))) : 3;
}

/** Remove trailing zeros after a decimal point, and the point itself if nothing is left. */
function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/** True iff `x` displays as zero at `digits` decimals (|x| < 10^−digits, or ±0). */
function isDisplayZero(x: number, digits: number): boolean {
  return Math.abs(x) < 10 ** -clampDigits(digits);
}

function parts(x: number, digits: number): Parts {
  if (Number.isNaN(x)) return { kind: 'nan' };
  if (!Number.isFinite(x)) return { kind: 'inf', negative: x < 0 };
  const d = clampDigits(digits);
  if (isDisplayZero(x, d)) return { kind: 'zero' };
  const negative = x < 0;
  const a = Math.abs(x);
  if (a >= EXPONENT_FROM) {
    const [m, e] = a.toExponential(d).split('e');
    return { kind: 'exp', negative, mantissa: trimZeros(m), exponent: Number(e) };
  }
  const body = trimZeros(a.toFixed(d));
  return body === '0' ? { kind: 'zero' } : { kind: 'fixed', negative, body };
}

function plain(p: Parts): string {
  switch (p.kind) {
    case 'zero':
      return '0';
    case 'nan':
      return 'NaN';
    case 'inf':
      return p.negative ? `${MINUS}∞` : '∞';
    case 'fixed':
      return (p.negative ? MINUS : '') + p.body;
    case 'exp':
      return `${p.negative ? MINUS : ''}${p.mantissa}e${p.exponent}`;
  }
}

function latex(p: Parts): string {
  switch (p.kind) {
    case 'zero':
      return '0';
    case 'nan':
      return '\\text{NaN}';
    case 'inf':
      return p.negative ? '-\\infty' : '\\infty';
    case 'fixed':
      return (p.negative ? '-' : '') + p.body;
    case 'exp':
      return `${p.negative ? '-' : ''}${p.mantissa} \\times 10^{${p.exponent}}`;
  }
}

/** Plain-text number: at most `digits` decimals, trailing zeros trimmed, −0 → 0, |x|<tiny → 0. */
export function formatNumber(x: number, digits = 3): string {
  return plain(parts(x, digits));
}

/**
 * Shared layout of a complex number, "a", "bi", "−bi", "a + bi" or "a − bi", where a part that
 * displays as zero is left out. `num` formats a non-negative or signed real, and `minus` is the
 * sign used between and in front of the terms.
 */
function complexText(
  z: Complex,
  digits: number,
  num: (x: number) => string,
  minus: string,
): string {
  if (Number.isNaN(z.re) || Number.isNaN(z.im)) return num(NaN);
  if (isDisplayZero(z.im, digits)) return num(z.re);
  const im = `${num(Math.abs(z.im))}i`;
  if (isDisplayZero(z.re, digits)) return z.im < 0 ? `${minus}${im}` : im;
  return `${num(z.re)} ${z.im < 0 ? minus : '+'} ${im}`;
}

/** Plain-text complex: "a", "bi", "a + bi", "a − bi". */
export function formatComplex(z: Complex, digits = 3): string {
  return complexText(z, digits, (x) => formatNumber(x, digits), MINUS);
}

/** KaTeX number (uses ASCII '-'). */
export function numberToLatex(x: number, digits = 3): string {
  return latex(parts(x, digits));
}

/** KaTeX complex number: same layout as formatComplex, with ASCII '-'. */
export function complexToLatex(z: Complex, digits = 3): string {
  return complexText(z, digits, (x) => numberToLatex(x, digits), '-');
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
  const cells: string[] = [];
  for (let i = 0; i < v.length; i++) cells.push(numberToLatex(v[i], digits));
  return `\\begin{bmatrix} ${cells.join(' \\\\ ')} \\end{bmatrix}`;
}
