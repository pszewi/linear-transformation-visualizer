/** Global keyboard shortcuts: one table drives both the handler and the help dialog. */
import { isTypingTarget, MOD_KEY } from '../lib/dom';

export interface ShortcutActions {
  undo(): void;
  redo(): void;
  setDimension(n: 2 | 3): void;
  resetCamera(): void;
  showHelp(): void;
}

export interface ShortcutInfo {
  readonly keys: readonly string[];
  readonly label: string;
}

export interface ShortcutGroup {
  readonly title: string;
  readonly items: readonly ShortcutInfo[];
}

export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  {
    title: 'General',
    items: [
      { keys: [MOD_KEY, 'Z'], label: 'Undo' },
      { keys: ['⇧', MOD_KEY, 'Z'], label: 'Redo' },
      { keys: ['2'], label: 'Switch to 2D' },
      { keys: ['3'], label: 'Switch to 3D' },
      { keys: ['R'], label: 'Reset camera' },
      { keys: ['?'], label: 'Show keyboard shortcuts' },
    ],
  },
  {
    title: 'Numbers',
    items: [
      { keys: ['↑'], label: 'Step by 0.1 (↓ to decrease)' },
      { keys: ['⇧', '↑'], label: 'Step by 1' },
      { keys: ['Enter'], label: 'Type a value (Enter again to apply)' },
      { keys: ['Esc'], label: 'Cancel typing' },
      { keys: ['⇧', 'drag'], label: 'Fine scrub' },
    ],
  },
];

/** Handle a window keydown. Returns true if it was a shortcut (and prevents its default). */
export function handleShortcut(e: KeyboardEvent, actions: ShortcutActions): boolean {
  if (e.defaultPrevented || e.isComposing || isTypingTarget(e.target)) return false;
  const mod = e.metaKey || e.ctrlKey;
  const key = e.key.toLowerCase();
  let handled = true;
  if (mod && !e.altKey && key === 'z') {
    if (e.shiftKey) actions.redo();
    else actions.undo();
  } else if (mod && !e.altKey && !e.shiftKey && key === 'y') {
    actions.redo();
  } else if (mod || e.altKey) {
    handled = false;
  } else if (e.key === '2' || e.key === '3') {
    actions.setDimension(e.key === '2' ? 2 : 3);
  } else if (key === 'r') {
    actions.resetCamera();
  } else if (e.key === '?') {
    actions.showHelp();
  } else {
    handled = false;
  }
  if (handled) e.preventDefault();
  return handled;
}
