/**
 * Debug hook for QA perf/leak tests: `window.__LTV_DEBUG__`, installed in dev builds or when
 * the URL has `?debug`. Reading it is cheap; the engine only bumps two numbers per render.
 */
export interface LtvDebugInfo {
  readonly geometries: number;
  readonly textures: number;
  readonly programs: number;
  /** Draw calls of the most recent render. */
  readonly calls: number;
}

export interface LtvDebug {
  /** Total WebGL renders since mount. */
  renders: number;
  /** CPU time of the most recent rendered frame (update + render), ms. */
  lastFrameMs: number;
  info(): LtvDebugInfo;
}

declare global {
  interface Window {
    __LTV_DEBUG__?: LtvDebug;
  }
}

export function debugEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return new URLSearchParams(window.location.search).has('debug');
  } catch {
    return false;
  }
}
