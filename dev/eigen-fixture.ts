/**
 * DEV ONLY — a small closed-form eigen solver (2×2, 3×3) used to fake the `eigen` part of
 * Analysis in the engine playground while core/analysis.ts is still a stub. Not production
 * math: no tests, no defectiveness subtleties beyond the basics.
 */
import { analyze, type Analysis, type Complex, type EigenSpace } from '../src/core/analysis';
import type { Matrix } from '../src/core/linalg/matrix';
import { eigenClusterTolFor, tolFor } from '../src/core/tolerance';

type V3 = [number, number, number];

function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
const norm = (v: readonly number[]): number => Math.hypot(...v);
const unit = (v: number[]): Float64Array => {
  const n = norm(v);
  return Float64Array.from(v.map((x) => x / n));
};

/** Kernel basis of a 2×2 or 3×3 matrix given as rows. */
function kernel(rows: number[][], tol: number): Float64Array[] {
  const n = rows.length;
  if (n === 2) {
    const [[a, b], [c, d]] = rows;
    const r = norm([a, b]) >= norm([c, d]) ? [a, b] : [c, d];
    if (norm(r) <= tol) return [Float64Array.of(1, 0), Float64Array.of(0, 1)];
    return [unit([-r[1], r[0]])];
  }
  const r = rows as V3[];
  const crosses = [cross(r[0], r[1]), cross(r[0], r[2]), cross(r[1], r[2])];
  const best = crosses.reduce((p, q) => (norm(q) > norm(p) ? q : p));
  if (norm(best) > tol) return [unit(best)];
  const row = r.reduce((p, q) => (norm(q) > norm(p) ? q : p));
  if (norm(row) <= tol) {
    return [Float64Array.of(1, 0, 0), Float64Array.of(0, 1, 0), Float64Array.of(0, 0, 1)];
  }
  const u = unit(row);
  const seed: V3 = Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const a = unit(cross([u[0], u[1], u[2]], seed));
  const b = unit(cross([u[0], u[1], u[2]], [a[0], a[1], a[2]]));
  return [a, b];
}

/** Roots of λ³ + p2 λ² + p1 λ + p0. */
function cubicRoots(p2: number, p1: number, p0: number): Complex[] {
  const shift = -p2 / 3;
  const p = p1 - (p2 * p2) / 3;
  const q = (2 * p2 * p2 * p2) / 27 - (p2 * p1) / 3 + p0;
  const disc = (q * q) / 4 + (p * p * p) / 27;
  if (disc > 1e-14) {
    const s = Math.sqrt(disc);
    const u = Math.cbrt(-q / 2 + s);
    const v = Math.cbrt(-q / 2 - s);
    const re = -(u + v) / 2 + shift;
    const im = ((u - v) * Math.sqrt(3)) / 2;
    return [
      { re: u + v + shift, im: 0 },
      { re, im: Math.abs(im) },
      { re, im: -Math.abs(im) },
    ];
  }
  if (Math.abs(p) < 1e-14) {
    const r = Math.cbrt(-q) + shift;
    return [r, r, r].map((re) => ({ re, im: 0 }));
  }
  const m = 2 * Math.sqrt(-p / 3);
  const arg = Math.max(-1, Math.min(1, ((3 * q) / (p * m)) * 1));
  const theta = Math.acos(arg) / 3;
  return [0, 1, 2].map((k) => ({ re: m * Math.cos(theta - (2 * Math.PI * k) / 3) + shift, im: 0 }));
}

function eigenValues(m: Matrix): Complex[] {
  const d = m.data;
  if (m.rows === 2) {
    const tr = d[0] + d[3];
    const det = d[0] * d[3] - d[1] * d[2];
    const disc = (tr * tr) / 4 - det;
    if (disc < 0) {
      const im = Math.sqrt(-disc);
      return [
        { re: tr / 2, im },
        { re: tr / 2, im: -im },
      ];
    }
    const s = Math.sqrt(disc);
    return [
      { re: tr / 2 + s, im: 0 },
      { re: tr / 2 - s, im: 0 },
    ];
  }
  const tr = d[0] + d[4] + d[8];
  const minors =
    d[4] * d[8] - d[5] * d[7] + (d[0] * d[8] - d[2] * d[6]) + (d[0] * d[4] - d[1] * d[3]);
  const det =
    d[0] * (d[4] * d[8] - d[5] * d[7]) -
    d[1] * (d[3] * d[8] - d[5] * d[6]) +
    d[2] * (d[3] * d[7] - d[4] * d[6]);
  return cubicRoots(-tr, minors, -det);
}

export function devAnalyze(m: Matrix): Analysis {
  const base = analyze(m);
  if (!base.square || (m.rows !== 2 && m.rows !== 3)) return base;
  const n = m.rows;
  const values = eigenValues(m).sort((a, b) =>
    a.im === 0 && b.im !== 0 ? -1 : a.im !== 0 && b.im === 0 ? 1 : b.re - a.re,
  );
  const cluster = eigenClusterTolFor(m);
  const tol = Math.sqrt(tolFor(m)) * 10;
  const spaces: EigenSpace[] = [];
  let defective = false;
  for (const v of values) {
    const same = spaces.find(
      (s) =>
        Math.abs(s.value.re - v.re) < cluster * 10 && Math.abs(s.value.im - v.im) < cluster * 10,
    );
    if (same) {
      (same as { algebraicMultiplicity: number }).algebraicMultiplicity++;
      continue;
    }
    if (v.im !== 0) {
      spaces.push({ value: v, algebraicMultiplicity: 1, geometricMultiplicity: 0, basis: [] });
      continue;
    }
    const rows: number[][] = [];
    for (let i = 0; i < n; i++) {
      rows.push(Array.from({ length: n }, (_, j) => m.data[i * n + j] - (i === j ? v.re : 0)));
    }
    const basis = kernel(rows, tol);
    spaces.push({
      value: v,
      algebraicMultiplicity: 1,
      geometricMultiplicity: basis.length,
      basis,
    });
  }
  for (const s of spaces) {
    if (s.value.im === 0 && s.geometricMultiplicity < s.algebraicMultiplicity) defective = true;
  }
  return { ...base, eigen: { values, spaces, defective } };
}
