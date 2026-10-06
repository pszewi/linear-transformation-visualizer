/** Number parsing/rounding for editable numeric fields. No eval: a tiny explicit grammar. */

const DECIMAL = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

function parseDecimal(s: string): number | null {
  if (!DECIMAL.test(s)) return null;
  const x = Number(s);
  return Number.isFinite(x) ? x : null;
}

/**
 * Parse user input: decimals ("1.5", "-.25", "2e-3"), the true minus sign (U+2212), a comma
 * decimal separator, and simple fractions ("1/2", "−3/4"). Returns null if not understood.
 */
export function parseNumberInput(input: string): number | null {
  const s = input.trim().replace(/−/g, '-').replace(/,/g, '.').replace(/\s+/g, '');
  if (s === '') return null;
  const slash = s.indexOf('/');
  if (slash < 0) return parseDecimal(s);
  const num = parseDecimal(s.slice(0, slash));
  const den = parseDecimal(s.slice(slash + 1));
  if (num === null || den === null || den === 0) return null;
  const x = num / den;
  return Number.isFinite(x) ? x : null;
}

/** Round to a multiple of `quantum` without binary noise (0.1 + 0.2 → 0.3). */
export function roundTo(x: number, quantum: number): number {
  const decimals = Math.max(0, Math.ceil(-Math.log10(quantum) - 1e-9));
  const r = Number((Math.round(x / quantum) * quantum).toFixed(decimals));
  return r === 0 ? 0 : r;
}

/** Editable plain-text form of a value: up to 6 decimals, ASCII minus. */
export function editableText(x: number): string {
  return String(Number(x.toFixed(6)));
}
