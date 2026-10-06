import type { ViewInsets } from '../../engine';

/** Which canvas edge a floating element covers; 'none' opts out (e.g. a collapsed rail). */
export type OccludedEdge = 'top' | 'right' | 'bottom' | 'left' | 'none';

/**
 * Report how much of the viewport floating UI covers, so the engine can centre the scene in the
 * remaining area. Occluders are direct children of `root` marked `data-occludes="<edge>"`.
 *
 * Distances are measured against `frame` (the viewport host: the exact box the canvas fills; `root`
 * itself may have zero height because its children are fixed-position), not the window, so pinch-zoom, mobile URL-bar transitions and scrollbars cannot skew them. Re-measures
 * when an occluder resizes (collapse, sheet drag), when the set of children changes (sidebar ↔
 * bottom sheet), when an occluder's edge attribute changes, and on window resize. Only `root`'s
 * direct children are watched, so panel content updates never trigger a re-measure.
 */
export function trackViewInsets(
  root: Element,
  frame: Element,
  onChange: (insets: ViewInsets) => void,
): () => void {
  const observed = new Set<Element>();
  const ro = new ResizeObserver(() => measure());

  function measure() {
    const els = root.querySelectorAll(':scope > [data-occludes]');
    for (const el of observed) {
      if (![...els].includes(el)) {
        ro.unobserve(el);
        observed.delete(el);
      }
    }
    const box = frame.getBoundingClientRect();
    const insets = { top: 0, right: 0, bottom: 0, left: 0 };
    for (const el of els) {
      if (!observed.has(el)) {
        ro.observe(el);
        observed.add(el);
      }
      const r = el.getBoundingClientRect();
      switch (el.getAttribute('data-occludes') as OccludedEdge | null) {
        case 'top':
          insets.top = Math.max(insets.top, r.bottom - box.top);
          break;
        case 'right':
          insets.right = Math.max(insets.right, box.right - r.left);
          break;
        case 'bottom':
          insets.bottom = Math.max(insets.bottom, box.bottom - r.top);
          break;
        case 'left':
          insets.left = Math.max(insets.left, r.right - box.left);
          break;
      }
    }
    for (const k of ['top', 'right', 'bottom', 'left'] as const) {
      insets[k] = Math.max(0, Math.round(insets[k]));
    }
    onChange(insets);
  }

  const mo = new MutationObserver(() => measure());
  mo.observe(root, { childList: true });
  // Edge changes (e.g. sidebar collapse) live on direct children; attributeFilter keeps this cheap.
  const attrs = new MutationObserver(() => measure());
  attrs.observe(root, { subtree: true, attributes: true, attributeFilter: ['data-occludes'] });
  addEventListener('resize', measure);
  measure();
  return () => {
    ro.disconnect();
    mo.disconnect();
    attrs.disconnect();
    removeEventListener('resize', measure);
  };
}
