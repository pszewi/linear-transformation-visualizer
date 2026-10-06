/**
 * Scene files on disk. Desktop (Tauri): native open/save dialogs plus two small Rust commands
 * (`read_scene`, `write_scene`, see src-tauri/src/lib.rs) that only touch .ltv/.json files.
 * Browser: a file picker and a download, so the web build keeps working.
 */
import { SCENE_EXTENSION } from '../state/persistence';

/** True inside the Tauri desktop shell. */
export const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** True on macOS (desktop or browser); decides the native menu bar. */
export const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

export interface SceneFileRef {
  /** Display name, e.g. "shear.ltv". */
  readonly name: string;
  /** Absolute path on desktop; null in the browser (downloads have no path). */
  readonly path: string | null;
}

const FILTERS = [{ name: 'Scene', extensions: [SCENE_EXTENSION, 'json'] }];

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function withExtension(path: string): string {
  return /\.(ltv|json)$/i.test(path) ? path : `${path}.${SCENE_EXTENSION}`;
}

/** Ask the user for a scene file. Resolves null if they cancel. */
export async function openSceneFile(): Promise<{ text: string; file: SceneFileRef } | null> {
  if (isDesktop) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { invoke } = await import('@tauri-apps/api/core');
    const path = await open({ multiple: false, directory: false, filters: FILTERS });
    if (typeof path !== 'string') return null;
    const text = await invoke<string>('read_scene', { path });
    return { text, file: { name: baseName(path), path } };
  }
  return pickInBrowser();
}

/**
 * Write `text` to a scene file. With a known `current.path` and `saveAs` false this overwrites it
 * silently; otherwise the user picks a location. Resolves null if they cancel.
 */
export async function saveSceneFile(
  text: string,
  current: SceneFileRef | null,
  saveAs: boolean,
): Promise<SceneFileRef | null> {
  const suggested = current?.name ?? `scene.${SCENE_EXTENSION}`;
  if (isDesktop) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { invoke } = await import('@tauri-apps/api/core');
    let path =
      !saveAs && current?.path
        ? current.path
        : await save({ defaultPath: suggested, filters: FILTERS });
    if (!path) return null;
    path = withExtension(path);
    await invoke('write_scene', { path, contents: text });
    return { name: baseName(path), path };
  }
  downloadInBrowser(text, withExtension(suggested));
  return { name: withExtension(suggested), path: null };
}

function pickInBrowser(): Promise<{ text: string; file: SceneFileRef } | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = `.${SCENE_EXTENSION},.json,application/json`;
    input.addEventListener('cancel', () => resolve(null));
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      f.text().then((text) => resolve({ text, file: { name: f.name, path: null } }), reject);
    });
    input.click();
  });
}

function downloadInBrowser(text: string, name: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Set the window title (native title bar on desktop, tab title in the browser). */
export async function setWindowTitle(title: string): Promise<void> {
  document.title = title;
  if (isDesktop) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().setTitle(title);
  }
}
