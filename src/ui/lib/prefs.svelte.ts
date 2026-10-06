/**
 * Per-viewer UI preferences (which panels are open, sidebar collapsed, …). Not part of the
 * scene document; kept in localStorage on a best-effort basis (storage may throw).
 */

const KEY = 'ltv.ui';

interface Prefs {
  sidebarCollapsed: boolean;
  /** Panel id → open. Missing → the panel's defaultOpen. */
  panels: Record<string, boolean>;
  entrySlidersOpen: boolean;
}

function load(): Prefs {
  const fallback: Prefs = { sidebarCollapsed: false, panels: {}, entrySlidersOpen: false };
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (typeof raw !== 'object' || raw === null) return fallback;
    const r = raw as Record<string, unknown>;
    const panels: Record<string, boolean> = {};
    if (typeof r.panels === 'object' && r.panels !== null) {
      for (const [k, v] of Object.entries(r.panels)) if (typeof v === 'boolean') panels[k] = v;
    }
    return {
      sidebarCollapsed: r.sidebarCollapsed === true,
      panels,
      entrySlidersOpen: r.entrySlidersOpen === true,
    };
  } catch {
    return fallback;
  }
}

export const prefs = $state<Prefs>(load());

let timer: ReturnType<typeof setTimeout> | undefined;
/** Persist soon (coalesces bursts of changes). */
export function savePrefs(): void {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify($state.snapshot(prefs)));
    } catch {
      // Storage unavailable: preferences simply don't persist.
    }
  }, 200);
}
