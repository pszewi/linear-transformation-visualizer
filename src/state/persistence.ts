/**
 * Loading and saving scene documents: strict validation, version migration, share links
 * (`#s=<base64url(JSON)>`) and debounced localStorage autosave.
 *
 * Everything that enters the app from outside (URL hash, storage, pasted JSON) goes through
 * `parseDocument`, which rebuilds a fresh document from known fields only. Unknown fields are
 * dropped; anything malformed rejects the whole document. Never `eval`.
 */
import type { InterpolationMode } from '../core/linalg/interpolate';
import {
  ambientDim,
  defaultDocument,
  DOCUMENT_VERSION,
  type SceneDocument,
  type SceneObject,
  type TransformNode,
  type ViewSettings,
} from './document';
import type { SceneEvent } from './events';
import { LAYERS } from './layers';
import {
  MAX_ABS_VALUE,
  MAX_ID_LENGTH,
  MAX_LABEL_LENGTH,
  MAX_MATRIX_DIM,
  MAX_OBJECTS,
  MAX_TRANSFORMS,
} from './limits';
import { isObjectColorKey } from './objectColors';

// ───────────────────────────── validation ─────────────────────────────

class InvalidDocument extends Error {}

function fail(message: string): never {
  throw new InvalidDocument(message);
}

type Rec = Record<string, unknown>;

function isRecord(x: unknown): x is Rec {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function record(x: unknown, what: string): Rec {
  if (!isRecord(x)) fail(`${what} must be an object`);
  return x;
}

function array(x: unknown, what: string, min: number, max: number): unknown[] {
  if (!Array.isArray(x)) fail(`${what} must be an array`);
  if (x.length < min || x.length > max) fail(`${what} must have ${min}–${max} items`);
  return x;
}

function finite(x: unknown, what: string): number {
  if (typeof x !== 'number' || !Number.isFinite(x)) fail(`${what} must be a finite number`);
  if (Math.abs(x) > MAX_ABS_VALUE) fail(`${what} exceeds ±${MAX_ABS_VALUE}`);
  return x === 0 ? 0 : x; // normalise −0
}

function id(x: unknown, what: string): string {
  if (typeof x !== 'string' || x.length === 0 || x.length > MAX_ID_LENGTH) {
    fail(`${what} must be a non-empty string of at most ${MAX_ID_LENGTH} characters`);
  }
  return x;
}

function label(x: unknown, what: string): string {
  if (typeof x !== 'string' || x.length > MAX_LABEL_LENGTH) {
    fail(`${what} must be a string of at most ${MAX_LABEL_LENGTH} characters`);
  }
  return x;
}

function numberVector(x: unknown, what: string, length: number): number[] {
  return array(x, what, length, length).map((v, k) => finite(v, `${what}[${k}]`));
}

function transformNode(x: unknown, k: number): TransformNode {
  const what = `transforms[${k}]`;
  const t = record(x, what);
  const rawRows = array(t.rows, `${what}.rows`, 1, MAX_MATRIX_DIM);
  const first = rawRows[0];
  const cols = Array.isArray(first) ? first.length : 0;
  if (cols < 1 || cols > MAX_MATRIX_DIM) fail(`${what}.rows has an invalid column count`);
  const rows = rawRows.map((r, i) => numberVector(r, `${what}.rows[${i}]`, cols));
  return { id: id(t.id, `${what}.id`), label: label(t.label, `${what}.label`), rows };
}

function sceneObject(x: unknown, k: number, domainDim: number): SceneObject {
  const what = `objects[${k}]`;
  const o = record(x, what);
  if (o.kind !== 'vector') fail(`${what}.kind is not a known object kind`);
  if (typeof o.visible !== 'boolean') fail(`${what}.visible must be a boolean`);
  const out: SceneObject = {
    id: id(o.id, `${what}.id`),
    kind: 'vector',
    visible: o.visible,
    coords: numberVector(o.coords, `${what}.coords`, domainDim),
  };
  if (o.label !== undefined) out.label = label(o.label, `${what}.label`);
  if (o.colorKey !== undefined) {
    if (!isObjectColorKey(o.colorKey)) fail(`${what}.colorKey is not a known colour`);
    out.colorKey = o.colorKey;
  }
  return out;
}

function interpolation(x: unknown): InterpolationMode {
  if (x !== 'linear' && x !== 'polar') fail('view.interpolation must be "linear" or "polar"');
  return x;
}

function viewSettings(x: unknown): ViewSettings {
  const v = record(x, 'view');
  const rawLayers = record(v.layers, 'view.layers');
  const layers: Record<string, boolean> = {};
  // Only known layer ids are kept (unknown ids are ignored, not copied).
  for (const layer of LAYERS) {
    const value = rawLayers[layer.id];
    if (value === undefined) continue;
    if (typeof value !== 'boolean') fail(`view.layers.${layer.id} must be a boolean`);
    layers[layer.id] = value;
  }
  return { layers, interpolation: interpolation(v.interpolation) };
}

/** Validate a document that is already at the current version. */
function validateCurrent(raw: Rec): SceneDocument {
  const transforms = array(raw.transforms, 'transforms', 1, MAX_TRANSFORMS).map(transformNode);
  for (let k = 1; k < transforms.length; k++) {
    if (transforms[k].rows[0].length !== transforms[k - 1].rows.length) {
      fail(`transforms[${k}] does not compose with transforms[${k - 1}]`);
    }
  }
  const shape = {
    rows: transforms[transforms.length - 1].rows.length,
    cols: transforms[0].rows[0].length,
  };
  try {
    ambientDim(shape);
  } catch {
    fail(`unsupported shape ${shape.rows}×${shape.cols}`);
  }
  const objects = array(raw.objects, 'objects', 0, MAX_OBJECTS).map((o, k) =>
    sceneObject(o, k, shape.cols),
  );
  const ids = new Set<string>();
  for (const node of [...transforms, ...objects]) {
    if (ids.has(node.id)) fail(`duplicate id "${node.id}"`);
    ids.add(node.id);
  }
  return { version: DOCUMENT_VERSION, transforms, objects, view: viewSettings(raw.view) };
}

// ───────────────────────────── migration ─────────────────────────────

/**
 * Migrations keyed by the version they upgrade FROM. `MIGRATIONS[n]` takes a version-n document
 * and returns a version-(n+1) document (still untrusted; validated afterwards).
 * When bumping DOCUMENT_VERSION, add an entry here and a test with an old-version fixture.
 */
export const MIGRATIONS: Readonly<Record<number, (doc: Rec) => Rec>> = {};

function migrate(raw: Rec): Rec {
  let doc = raw;
  let version = doc.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    fail('missing or invalid version');
  }
  if (version > DOCUMENT_VERSION) fail(`document version ${version} is newer than this app`);
  while (version < DOCUMENT_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) fail(`no migration from version ${version}`);
    doc = record(step(doc), 'migrated document');
    version += 1;
    if (doc.version !== version) fail(`migration to version ${version} failed`);
  }
  return doc;
}

export type ParseResult = { ok: true; doc: SceneDocument } | { ok: false; error: string };

/** Like `parseDocument`, but explains why a document was rejected. */
export function validateDocument(input: unknown): ParseResult {
  try {
    return { ok: true, doc: validateCurrent(migrate(record(input, 'document'))) };
  } catch (e) {
    if (e instanceof InvalidDocument) return { ok: false, error: e.message };
    return { ok: false, error: 'malformed document' };
  }
}

/** Validate + migrate untrusted input into a fresh, plain SceneDocument; null if invalid. */
export function parseDocument(input: unknown): SceneDocument | null {
  const result = validateDocument(input);
  return result.ok ? result.doc : null;
}

// ───────────────────────────── scene files ─────────────────────────────

/** File extension for saved scenes (the content is plain, human-readable JSON). */
export const SCENE_EXTENSION = 'ltv';
/** Largest scene file accepted (a full 16-vector 3D document is ~3 KB). */
const MAX_SCENE_BYTES = 256 * 1024;

/** Pretty-printed JSON for a scene file. */
export function serializeScene(doc: SceneDocument): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

/** Parse and validate a scene file's text; null if it is not a valid scene. */
export function parseSceneFile(text: string): SceneDocument | null {
  if (text.length > MAX_SCENE_BYTES) return null;
  try {
    return parseDocument(JSON.parse(text));
  } catch {
    return null;
  }
}

// ───────────────────────────── local storage ─────────────────────────────

export const STORAGE_KEY = 'ltv.scene';

/** Minimal storage interface (window.localStorage satisfies it). */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** window.localStorage, or null where access throws (privacy mode, sandboxed iframes). */
export function browserStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadFromStorage(storage: KeyValueStorage | null): SceneDocument | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? parseDocument(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Returns false if the write failed (quota exceeded, storage disabled). */
export function saveToStorage(storage: KeyValueStorage | null, doc: SceneDocument): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(doc));
    return true;
  } catch {
    return false;
  }
}

export interface AutosaveSource {
  snapshot(): SceneDocument;
  subscribe(listener: (event: SceneEvent) => void): () => void;
}

export interface Autosave {
  /** Write any pending change now (e.g. on `pagehide`). */
  flush(): void;
  dispose(): void;
}

/** Saves the document `delayMs` after the last change. Camera-only events are ignored. */
export function createAutosave(
  source: AutosaveSource,
  storage: KeyValueStorage | null,
  delayMs = 400,
): Autosave {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
    saveToStorage(storage, source.snapshot());
  };
  const unsubscribe = source.subscribe((event) => {
    if (event.type === 'resetCamera' || event.type === 'playSteps') return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(flush, delayMs);
  });
  return {
    flush,
    dispose() {
      flush();
      unsubscribe();
    },
  };
}

// ───────────────────────────── startup ─────────────────────────────

export type DocumentSource = 'storage' | 'default';

/** Startup order: autosaved document > default 2D scene. */
export function initialDocument(storage: KeyValueStorage | null): {
  doc: SceneDocument;
  source: DocumentSource;
} {
  const stored = loadFromStorage(storage);
  if (stored) return { doc: stored, source: 'storage' };
  return { doc: defaultDocument(2), source: 'default' };
}
