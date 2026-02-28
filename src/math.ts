import * as THREE from 'three';

// ─── 2×2 helpers ────────────────────────────────────────────────────────────

export function det2(m: number[][]): number {
  return m[0][0] * m[1][1] - m[0][1] * m[1][0];
}

export function applyMatrix2(
  v: [number, number],
  m: number[][]
): [number, number] {
  return [
    m[0][0] * v[0] + m[0][1] * v[1],
    m[1][0] * v[0] + m[1][1] * v[1],
  ];
}

/** Rank of a 2×2 matrix via reduced row echelon form. */
export function rank2(m: number[][]): number {
  const eps = 1e-10;
  const a = m[0][0], b = m[0][1];
  const c = m[1][0], d = m[1][1];

  if (Math.abs(a) > eps || Math.abs(b) > eps) {
    // Use row 0 as pivot row; eliminate column below
    const factor = (Math.abs(a) > eps ? c / a : 0);
    const newC = c - factor * a;
    const newD = d - factor * b;
    if (Math.abs(newC) > eps || Math.abs(newD) > eps) return 2;
    // Check if row 0 is non-zero
    return 1;
  }
  if (Math.abs(c) > eps || Math.abs(d) > eps) return 1;
  return 0;
}

/** Real eigenvalues of a 2×2 matrix (characteristic polynomial). */
export function eigenvalues2(m: number[][]): { real: number; imag: number }[] {
  const tr = m[0][0] + m[1][1];
  const det = det2(m);
  const disc = tr * tr - 4 * det;

  if (disc >= 0) {
    const sq = Math.sqrt(disc);
    return [
      { real: (tr + sq) / 2, imag: 0 },
      { real: (tr - sq) / 2, imag: 0 },
    ];
  } else {
    const sq = Math.sqrt(-disc);
    return [
      { real: tr / 2, imag: sq / 2 },
      { real: tr / 2, imag: -sq / 2 },
    ];
  }
}

/** Eigenvector for a 2×2 real eigenvalue λ. Returns null if degenerate. */
export function eigenvector2(
  m: number[][],
  lambda: number
): THREE.Vector2 | null {
  const eps = 1e-9;
  // (A - λI)v = 0
  const a = m[0][0] - lambda;
  const b = m[0][1];
  const c = m[1][0];
  const d = m[1][1] - lambda;

  if (Math.abs(a) > eps || Math.abs(b) > eps) {
    // from row 0: a*x + b*y = 0 → x = -b, y = a (if not both zero)
    return new THREE.Vector2(-b, a).normalize();
  }
  if (Math.abs(c) > eps || Math.abs(d) > eps) {
    return new THREE.Vector2(-d, c).normalize();
  }
  return null;
}

// ─── 3×3 helpers ────────────────────────────────────────────────────────────

export function det3(m: number[][]): number {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

export function applyMatrix3(
  v: [number, number, number],
  m: number[][]
): [number, number, number] {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

/** Rank of a 3×3 matrix via Gaussian elimination. */
export function rank3(m: number[][]): number {
  const eps = 1e-10;
  // deep copy
  const A: number[][] = m.map(row => [...row]);
  let rank = 0;
  const rows = 3, cols = 3;
  let pivotRow = 0;

  for (let col = 0; col < cols && pivotRow < rows; col++) {
    // find pivot
    let maxRow = pivotRow;
    for (let r = pivotRow + 1; r < rows; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[maxRow][col])) maxRow = r;
    }
    if (Math.abs(A[maxRow][col]) < eps) continue;
    [A[pivotRow], A[maxRow]] = [A[maxRow], A[pivotRow]];

    const scale = A[pivotRow][col];
    for (let c = col; c < cols; c++) A[pivotRow][c] /= scale;

    for (let r = 0; r < rows; r++) {
      if (r === pivotRow) continue;
      const factor = A[r][col];
      for (let c = col; c < cols; c++) A[r][c] -= factor * A[pivotRow][c];
    }
    rank++;
    pivotRow++;
  }
  return rank;
}

/**
 * Eigenvalues of a 3×3 real matrix via Cardano's method on the characteristic
 * polynomial  λ³ - tr·λ² + (sum of 2×2 principal minors)·λ - det = 0.
 */
export function eigenvalues3(
  m: number[][]
): { real: number; imag: number }[] {
  const tr = m[0][0] + m[1][1] + m[2][2];

  const c1 =
    m[0][0] * m[1][1] - m[0][1] * m[1][0] +
    m[0][0] * m[2][2] - m[0][2] * m[2][0] +
    m[1][1] * m[2][2] - m[1][2] * m[2][1];

  const c0 = det3(m);

  // Depressed cubic via substitution λ = t + tr/3
  // t³ + p·t + q = 0
  const a = tr;
  const b = c1;
  const c = c0;

  const p = b - (a * a) / 3;
  const q = (2 * a * a * a) / 27 - (a * b) / 3 + c;

  const D = (q * q) / 4 + (p * p * p) / 27; // discriminant

  const shift = a / 3;

  if (Math.abs(D) < 1e-10) {
    // repeated roots
    if (Math.abs(p) < 1e-10 && Math.abs(q) < 1e-10) {
      // triple root
      return [
        { real: shift, imag: 0 },
        { real: shift, imag: 0 },
        { real: shift, imag: 0 },
      ];
    }
    const t1 = 3 * q / p;   // simple root
    const t2 = -3 * q / (2 * p); // double root
    return [
      { real: t1 - shift, imag: 0 },
      { real: t2 - shift, imag: 0 },
      { real: t2 - shift, imag: 0 },
    ];
  }

  if (D > 0) {
    // one real, two complex conjugate
    const sqrtD = Math.sqrt(D);
    const u = Math.cbrt(-q / 2 + sqrtD);
    const v = Math.cbrt(-q / 2 - sqrtD);
    const realRoot = u + v - shift;

    const realPart = -(u + v) / 2 - shift;
    const imagPart = (Math.sqrt(3) / 2) * Math.abs(u - v);
    return [
      { real: realRoot, imag: 0 },
      { real: realPart, imag: imagPart },
      { real: realPart, imag: -imagPart },
    ];
  }

  // D < 0: three distinct real roots (casus irreducibilis — use trig method)
  const r = Math.sqrt(-(p * p * p) / 27);
  const phi = Math.acos((-q / 2) / r);
  const m2 = 2 * Math.cbrt(r);

  return [
    { real: m2 * Math.cos(phi / 3) - shift, imag: 0 },
    { real: m2 * Math.cos((phi + 2 * Math.PI) / 3) - shift, imag: 0 },
    { real: m2 * Math.cos((phi + 4 * Math.PI) / 3) - shift, imag: 0 },
  ];
}

/** Eigenvector for a 3×3 real eigenvalue λ. Returns null if degenerate. */
export function eigenvector3(
  m: number[][],
  lambda: number
): THREE.Vector3 | null {
  const eps = 1e-9;
  // B = A - λI
  const B = m.map((row, i) =>
    row.map((v, j) => v - (i === j ? lambda : 0))
  );

  // Cross products of rows — at least two rows must be linearly dependent at
  // a true eigenvalue; their cross product gives the kernel direction.
  const candidates: THREE.Vector3[] = [];

  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) {
      const ri = B[i], rj = B[j];
      const cx = ri[1] * rj[2] - ri[2] * rj[1];
      const cy = ri[2] * rj[0] - ri[0] * rj[2];
      const cz = ri[0] * rj[1] - ri[1] * rj[0];
      const len = Math.sqrt(cx * cx + cy * cy + cz * cz);
      if (len > eps) {
        candidates.push(new THREE.Vector3(cx / len, cy / len, cz / len));
      }
    }
  }

  if (candidates.length === 0) return null;
  // Return the most consistent candidate (largest cross product)
  return candidates.reduce((best, v) => (v.length() > best.length() ? v : best));
}

// ─── Interpolation ───────────────────────────────────────────────────────────

export function lerpMatrix(
  a: number[][],
  b: number[][],
  t: number
): number[][] {
  return a.map((row, i) =>
    row.map((v, j) => v + (b[i][j] - v) * t)
  );
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

export function fmtNum(x: number, digits = 4): string {
  if (Math.abs(x) < 1e-10) return '0';
  const s = parseFloat(x.toFixed(digits)).toString();
  return s;
}

export function fmtEigen(evs: { real: number; imag: number }[]): string {
  return evs
    .map(ev => {
      if (Math.abs(ev.imag) < 1e-8) return fmtNum(ev.real, 3);
      const sign = ev.imag >= 0 ? '+' : '−';
      return `${fmtNum(ev.real, 3)} ${sign} ${fmtNum(Math.abs(ev.imag), 3)}i`;
    })
    .join(',  ');
}
