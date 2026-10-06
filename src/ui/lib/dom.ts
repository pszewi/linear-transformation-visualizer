/** Small DOM helpers shared by components. */

let counter = 0;
/** Unique id for aria wiring (aria-controls, aria-describedby, label for=…). */
export function uid(prefix = 'ui'): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

/** Svelte action: move the node to <body> so it escapes clipping/containing blocks. */
export function portal(node: HTMLElement) {
  document.body.appendChild(node);
  return {
    destroy() {
      node.remove();
    },
  };
}

/** True when keyboard events should go to the focused field instead of app shortcuts. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'range', 'reset', 'submit'].includes(target.type);
  }
  return false;
}

export function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Platform-appropriate label for the primary modifier. */
export const MOD_KEY =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

/** Platform-appropriate label for the Alt/Option modifier. */
export const ALT_KEY = MOD_KEY === '⌘' ? '⌥' : 'Alt';
