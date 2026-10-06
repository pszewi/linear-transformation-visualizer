import { describe, expect, it } from 'vitest';
import {
  complexToLatex,
  formatComplex,
  formatNumber,
  matrixToLatex,
  numberToLatex,
  vectorToLatex,
} from '../../src/core/format';
import { fromRows } from '../../src/core/linalg/matrix';

const M = '−';

describe('formatNumber', () => {
  it('trims trailing zeros and rounds to `digits` decimals', () => {
    expect(formatNumber(1)).toBe('1');
    expect(formatNumber(1.5)).toBe('1.5');
    expect(formatNumber(2.0004)).toBe('2');
    expect(formatNumber(Math.PI)).toBe('3.142');
    expect(formatNumber(Math.PI, 0)).toBe('3');
    expect(formatNumber(1234567.25, 1)).toBe('1234567.3');
  });

  it('uses the true minus sign U+2212', () => {
    expect(formatNumber(-2.5)).toBe(`${M}2.5`);
    expect(formatNumber(-2.5)).not.toContain('-');
  });

  it('never shows −0; tiny values become 0', () => {
    expect(formatNumber(-0)).toBe('0');
    expect(formatNumber(1e-12)).toBe('0');
    expect(formatNumber(-1e-12)).toBe('0');
    expect(formatNumber(-0.0004)).toBe('0');
    expect(formatNumber(0.0004, 3)).toBe('0');
    expect(formatNumber(0.0004, 4)).toBe('0.0004');
    expect(formatNumber(5e-7, 10)).toBe('0.0000005');
  });

  it('NaN and ±Infinity', () => {
    expect(formatNumber(NaN)).toBe('NaN');
    expect(formatNumber(Infinity)).toBe('∞');
    expect(formatNumber(-Infinity)).toBe(`${M}∞`);
  });

  it('huge magnitudes use exponent form', () => {
    expect(formatNumber(1.5e22)).toBe('1.5e22');
    expect(formatNumber(-2e30)).toBe(`${M}2e30`);
  });
});

describe('formatComplex', () => {
  it('covers the forms a, bi, −bi, a + bi, a − bi', () => {
    expect(formatComplex({ re: 2, im: 0 })).toBe('2');
    expect(formatComplex({ re: -2, im: 1e-15 })).toBe(`${M}2`);
    expect(formatComplex({ re: 0, im: 2 })).toBe('2i');
    expect(formatComplex({ re: 1e-14, im: -0.5 })).toBe(`${M}0.5i`);
    expect(formatComplex({ re: 1, im: 2 })).toBe('1 + 2i');
    expect(formatComplex({ re: -1, im: -2.25 })).toBe(`${M}1 ${M} 2.25i`);
    expect(formatComplex({ re: 0, im: 0 })).toBe('0');
    expect(formatComplex({ re: -0, im: -0 })).toBe('0');
  });

  it('writes a unit imaginary part as a bare i: i, −i, a + i, a − i', () => {
    expect(formatComplex({ re: 0, im: 1 })).toBe('i');
    expect(formatComplex({ re: 0, im: -1 })).toBe(`${M}i`);
    expect(formatComplex({ re: 2, im: 1 })).toBe('2 + i');
    expect(formatComplex({ re: -2, im: -1 })).toBe(`${M}2 ${M} i`);
    // Only when |im| DISPLAYS exactly as 1: rounding to 1 counts, 1.5 or 0.999 at 4 digits do not.
    expect(formatComplex({ re: 0, im: 1.0000001 })).toBe('i');
    expect(formatComplex({ re: 0, im: 0.9999 }, 4)).toBe('0.9999i');
    expect(formatComplex({ re: 0, im: 1.5 })).toBe('1.5i');
    expect(formatComplex({ re: 0, im: 11 })).toBe('11i');
    expect(complexToLatex({ re: 0, im: -1 })).toBe('-i');
    expect(complexToLatex({ re: 3, im: -1 })).toBe('3 - i');
    expect(complexToLatex({ re: 3, im: 1 })).toBe('3 + i');
  });

  it('respects `digits` for the zero test of each part', () => {
    expect(formatComplex({ re: 0.5, im: 0.004 }, 2)).toBe('0.5');
    expect(formatComplex({ re: 0.5, im: 0.004 }, 3)).toBe('0.5 + 0.004i');
  });

  it('NaN anywhere gives NaN', () => {
    expect(formatComplex({ re: NaN, im: 1 })).toBe('NaN');
  });
});

describe('LaTeX builders', () => {
  it('use ASCII minus and LaTeX specials', () => {
    expect(numberToLatex(-2.5)).toBe('-2.5');
    expect(numberToLatex(-0)).toBe('0');
    expect(numberToLatex(-Infinity)).toBe('-\\infty');
    expect(numberToLatex(NaN)).toBe('\\text{NaN}');
    expect(numberToLatex(3e25)).toBe('3 \\times 10^{25}');
    expect(complexToLatex({ re: -1, im: -2 })).toBe('-1 - 2i');
    expect(complexToLatex({ re: 0, im: -2 })).toBe('-2i');
    for (const s of [numberToLatex(-1), complexToLatex({ re: -1, im: -1 })]) {
      expect(s).not.toContain(M);
    }
  });

  it('matrix and vector', () => {
    expect(
      matrixToLatex(
        fromRows([
          [1, -0.5],
          [1e-9, 2],
        ]),
      ),
    ).toBe('\\begin{bmatrix} 1 & -0.5 \\\\ 0 & 2 \\end{bmatrix}');
    expect(vectorToLatex([0.125, -3])).toBe('\\begin{bmatrix} 0.13 \\\\ -3 \\end{bmatrix}');
  });
});
