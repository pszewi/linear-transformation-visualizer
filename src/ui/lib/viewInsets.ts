import type { ViewInsets } from '../../engine';

/**
 * Report how much of the viewport the floating inspector covers, so the engine can centre the
 * scene in the remaining area. The inspector marks itself with `data-occludes="right|bottom"`.
 * Re-measures on element resize (collapse, sheet drag) and on window resize; the element is
 * looked up afresh each time because the layout swaps sidebar ↔ bottom sheet.
 */
export function trackViewInsets(root: Element, onChange: (insets: ViewInsets) => void): () => void {
  let observed: Element | null = null;
  const ro = new ResizeObserver(() => measure());

  function measure() {
    const el = root.querySelector(':scope > [data-occludes]');
    if (el !== observed) {
      if (observed) ro.unobserve(observed);
      if (el) ro.observe(el);
      observed = el;
    }
    const insets = { top: 0, right: 0, bottom: 0, left: 0 };
    if (el) {
      const r = el.getBoundingClientRect();
      const side = el.getAttribute('data-occludes');
      if (side === 'right') insets.right = Math.max(0, innerWidth - r.left);
      else if (side === 'bottom') insets.bottom = Math.max(0, innerHeight - r.top);
    }
    onChange(insets);
  }

  // The layout swaps sidebar ↔ sheet as direct children of `root`; watch only that level so
  // panel content updates (e.g. KaTeX during a drag) never trigger a re-measure.
  const mo = new MutationObserver(() => measure());
  mo.observe(root, { childList: true });
  addEventListener('resize', measure);
  measure();
  return () => {
    ro.disconnect();
    mo.disconnect();
    removeEventListener('resize', measure);
  };
}
