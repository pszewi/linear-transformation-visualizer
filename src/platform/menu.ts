/**
 * Native macOS menu bar for the desktop app. Windows gets no menu bar (a light Win32 menu would
 * clash with the dark UI); there the in-app keyboard shortcuts cover everything.
 *
 * On macOS, menu accelerators consume their key equivalents before the web view sees them, so
 * ⌘O/⌘S/⌘Z are handled here and never double-fire with the in-app shortcut handler.
 */
import { isTypingTarget } from '../ui/lib/dom';
import { isDesktop, isMac } from './files';

export interface MenuActions {
  open(): void;
  save(): void;
  saveAs(): void;
  undo(): void;
  redo(): void;
  setDimension(n: 2 | 3): void;
  resetCamera(): void;
  showHelp(): void;
}

/** While typing in a field, ⌘Z/⇧⌘Z edit the text instead of the scene. */
function textAware(command: 'undo' | 'redo', fallback: () => void): () => void {
  return () => {
    if (isTypingTarget(document.activeElement)) document.execCommand(command);
    else fallback();
  };
}

export async function installAppMenu(actions: MenuActions): Promise<void> {
  if (!isDesktop || !isMac) return;
  const { Menu, MenuItem, PredefinedMenuItem, Submenu } = await import('@tauri-apps/api/menu');
  const sep = () => PredefinedMenuItem.new({ item: 'Separator' });
  const item = (text: string, action: () => void, accelerator?: string) =>
    MenuItem.new({ text, action, accelerator });

  const app = await Submenu.new({
    text: 'Linear Transformation Visualizer',
    items: [
      await PredefinedMenuItem.new({ item: 'Hide' }),
      await PredefinedMenuItem.new({ item: 'HideOthers' }),
      await PredefinedMenuItem.new({ item: 'ShowAll' }),
      await sep(),
      await PredefinedMenuItem.new({ item: 'Quit' }),
    ],
  });
  const file = await Submenu.new({
    text: 'File',
    items: [
      await item('Open Scene…', actions.open, 'CmdOrCtrl+O'),
      await sep(),
      await item('Save Scene', actions.save, 'CmdOrCtrl+S'),
      await item('Save Scene As…', actions.saveAs, 'CmdOrCtrl+Shift+S'),
      await sep(),
      await PredefinedMenuItem.new({ item: 'CloseWindow' }),
    ],
  });
  const edit = await Submenu.new({
    text: 'Edit',
    items: [
      await item('Undo', textAware('undo', actions.undo), 'CmdOrCtrl+Z'),
      await item('Redo', textAware('redo', actions.redo), 'CmdOrCtrl+Shift+Z'),
      await sep(),
      await PredefinedMenuItem.new({ item: 'Cut' }),
      await PredefinedMenuItem.new({ item: 'Copy' }),
      await PredefinedMenuItem.new({ item: 'Paste' }),
      await PredefinedMenuItem.new({ item: 'SelectAll' }),
    ],
  });
  // Single-key shortcuts (2, 3, R, ?) stay in-app: as menu accelerators they would steal typing.
  const view = await Submenu.new({
    text: 'View',
    items: [
      await item('2D', () => actions.setDimension(2)),
      await item('3D', () => actions.setDimension(3)),
      await sep(),
      await item('Reset Camera', actions.resetCamera),
      await sep(),
      await PredefinedMenuItem.new({ item: 'Fullscreen' }),
    ],
  });
  const window = await Submenu.new({
    text: 'Window',
    items: [await PredefinedMenuItem.new({ item: 'Minimize' })],
  });
  const help = await Submenu.new({
    text: 'Help',
    items: [await item('Keyboard Shortcuts', actions.showHelp)],
  });
  const menu = await Menu.new({ items: [app, file, edit, view, window, help] });
  await menu.setAsAppMenu();
}
