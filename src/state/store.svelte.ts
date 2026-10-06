/**
 * The application store: one reactive SceneDocument plus actions, undo/redo and the event
 * stream consumed by the engine. Implements store.types.ts.
 *
 * Reactivity: `doc` is deep `$state`, so a component reading `doc.transforms[0].rows[i][j]`
 * only re-runs when that entry changes. `matrix` and `analysis` are `$derived` (lazy, memoised).
 *
 * History: snapshots of the *content* (transforms + objects). View settings (layers,
 * interpolation) are preferences and are deliberately not part of undo.
 */
import { analyze } from '../core/analysis';
import type { InterpolationMode } from '../core/linalg/interpolate';
import { identity, sameShape, toRows } from '../core/linalg/matrix';
import {
  ambientDim,
  defaultDocument,
  documentShape,
  effectiveMatrix,
  newId,
  type SceneDocument,
  type SceneObject,
  type TransformNode,
} from './document';
import type { SceneEvent, SceneEventListener } from './events';
import { LAYERS } from './layers';
import { clampValue, HISTORY_LIMIT, MAX_LABEL_LENGTH, MAX_OBJECTS } from './limits';
import { colorKeyFor, isObjectColorKey } from './objectColors';
import { parseDocument } from './persistence';
import { getPreset } from './presets';
import type { EditPhase, SceneStore } from './store.types';

/** Index of the transform node edited by setEntry/setMatrix (v1 has exactly one node). */
export const ACTIVE_TRANSFORM = 0;

interface HistoryEntry {
  readonly transforms: TransformNode[];
  readonly objects: SceneObject[];
}

type ObjectPatch = Partial<Omit<SceneObject, 'id' | 'kind'>>;

const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';
function subscript(n: number): string {
  return String(n).replace(/\d/g, (d) => SUBSCRIPT_DIGITS[Number(d)]);
}

function cleanNumbers(values: readonly number[]): number[] | null {
  return values.every((x) => Number.isFinite(x)) ? values.map(clampValue) : null;
}

export interface StoreOptions {
  /** Starting document (already validated, e.g. from persistence). Defaults to 2D identity. */
  initial?: SceneDocument;
}

export function createStore(options: StoreOptions = {}): SceneStore {
  let doc = $state<SceneDocument>(structuredClone(options.initial ?? defaultDocument(2)));

  const shape = $derived(documentShape(doc));
  const dim = $derived(ambientDim(shape));
  const matrix = $derived(effectiveMatrix(doc));
  const analysis = $derived(analyze(matrix));

  let past = $state.raw<HistoryEntry[]>([]);
  let future = $state.raw<HistoryEntry[]>([]);
  /** Content before the current continuous gesture began; null when no gesture is active. */
  let gestureBase: HistoryEntry | null = null;

  // Plain Set on purpose: listeners are not reactive state.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const listeners = new Set<SceneEventListener>();

  // ── helpers ──

  function emit(event: SceneEvent): void {
    for (const listener of [...listeners]) {
      try {
        listener(event);
      } catch (error) {
        console.error('Scene listener failed', error);
      }
    }
  }

  const active = () => doc.transforms[ACTIVE_TRANSFORM];

  function capture(): HistoryEntry {
    return {
      transforms: $state.snapshot(doc.transforms) as TransformNode[],
      objects: $state.snapshot(doc.objects) as SceneObject[],
    };
  }

  const sameContent = (a: HistoryEntry, b: HistoryEntry) => JSON.stringify(a) === JSON.stringify(b);

  function pushHistory(before: HistoryEntry): void {
    past = [...past.slice(-(HISTORY_LIMIT - 1)), before];
    future = [];
  }

  /** A completed gesture left dangling (no 'end') is folded into the next history entry. */
  function takeBase(): HistoryEntry {
    const base = gestureBase ?? capture();
    gestureBase = null;
    return base;
  }

  const emitMatrix = (animate: boolean) => emit({ type: 'matrix', matrix, animate });
  const emitObjects = () =>
    emit({ type: 'objects', objects: $state.snapshot(doc.objects) as SceneObject[] });
  const emitView = () => emit({ type: 'view', view: $state.snapshot(doc.view) });
  const emitLoad = () => emit({ type: 'load', doc: snapshot() });

  /**
   * Run a content mutation with edit-phase semantics:
   * live → no history; end → one entry for the whole gesture; commit → one entry.
   */
  function edit(phase: EditPhase, mutate: () => void, notify: (animate: boolean) => void): void {
    if (phase === 'live') {
      gestureBase ??= capture();
      mutate();
      notify(false);
      return;
    }
    const before = takeBase();
    mutate();
    const changed = !sameContent(before, capture());
    if (changed) pushHistory(before);
    if (changed || phase === 'end') notify(phase === 'commit');
  }

  /** Replace content (undo/redo/preset across shapes); emits load or fine-grained events. */
  function restore(entry: HistoryEntry): void {
    const oldShape = shape;
    const old = capture();
    doc.transforms = structuredClone(entry.transforms);
    doc.objects = structuredClone(entry.objects);
    if (!sameShape(oldShape, shape)) {
      emitLoad();
      return;
    }
    if (JSON.stringify(old.transforms) !== JSON.stringify(entry.transforms)) emitMatrix(true);
    if (JSON.stringify(old.objects) !== JSON.stringify(entry.objects)) emitObjects();
  }

  function snapshot(): SceneDocument {
    return $state.snapshot(doc) as SceneDocument;
  }

  function sanitizePatch(patch: ObjectPatch, current: SceneObject): ObjectPatch | null {
    const out: ObjectPatch = {};
    if (patch.coords !== undefined) {
      const coords = cleanNumbers(patch.coords);
      if (!coords || coords.length !== current.coords.length) return null;
      out.coords = coords;
    }
    if (patch.visible !== undefined) out.visible = Boolean(patch.visible);
    if (patch.label !== undefined) out.label = String(patch.label).slice(0, MAX_LABEL_LENGTH);
    if (patch.colorKey !== undefined) {
      if (!isObjectColorKey(patch.colorKey)) return null;
      out.colorKey = patch.colorKey;
    }
    return out;
  }

  function nextVectorLabel(): string {
    const used = doc.objects.map((o) => o.label);
    let n = 1;
    while (used.includes(`v${subscript(n)}`)) n += 1;
    return `v${subscript(n)}`;
  }

  // ── public surface ──

  const store: SceneStore = {
    get doc() {
      return doc;
    },
    get matrix() {
      return matrix;
    },
    get analysis() {
      return analysis;
    },
    get shape() {
      return shape;
    },
    get dim() {
      return dim;
    },

    setEntry(i, j, value, phase) {
      const rows = active().rows;
      if (!Number.isInteger(i) || !Number.isInteger(j) || i < 0 || j < 0) return;
      if (i >= rows.length || j >= rows[0].length || !Number.isFinite(value)) return;
      const v = clampValue(value);
      edit(
        phase,
        () => {
          rows[i][j] = v;
        },
        emitMatrix,
      );
    },

    setMatrix(next) {
      const rows = active().rows;
      const ok = next.length === rows.length && next.every((r) => r.length === rows[0].length);
      if (!ok) return;
      const clean = next.map(cleanNumbers);
      if (clean.some((r) => r === null)) return;
      edit(
        'commit',
        () => {
          active().rows = clean as number[][];
        },
        emitMatrix,
      );
    },

    setDimension(n) {
      if (n === dim && sameShape(shape, { rows: n, cols: n })) return;
      const before = takeBase();
      doc.transforms = [{ id: newId('t'), label: 'A', rows: toRows(identity(n)) }];
      doc.objects = [];
      pushHistory(before);
      emitLoad();
    },

    applyPreset(presetId) {
      const preset = getPreset(presetId);
      if (!preset) return;
      const rows = preset.rows.map((r) => [...r]);
      if (doc.transforms.length === 1 && sameShape(preset.shape, shape)) {
        store.setMatrix(rows);
        return;
      }
      // Different shape: replace the pipeline; objects only survive if the domain matches.
      const before = takeBase();
      const keepObjects = preset.shape.cols === shape.cols;
      doc.transforms = [{ id: active().id, label: active().label, rows }];
      if (!keepObjects) doc.objects = [];
      pushHistory(before);
      emitLoad();
    },

    addVector(coords) {
      if (doc.objects.length >= MAX_OBJECTS) return '';
      const n = shape.cols;
      const values = cleanNumbers(coords ?? new Array<number>(n).fill(1));
      if (!values || values.length !== n) return '';
      const id = newId('v');
      const colorKey = colorKeyFor(doc.objects.length);
      const label = nextVectorLabel();
      edit(
        'commit',
        () => {
          doc.objects.push({ id, kind: 'vector', visible: true, coords: values, label, colorKey });
        },
        emitObjects,
      );
      return id;
    },

    updateObject(id, patch, phase) {
      const target = doc.objects.find((o) => o.id === id);
      if (!target) return;
      const clean = sanitizePatch(patch, target);
      if (!clean) return;
      edit(phase, () => Object.assign(target, clean), emitObjects);
    },

    removeObject(id) {
      const index = doc.objects.findIndex((o) => o.id === id);
      if (index < 0) return;
      edit('commit', () => doc.objects.splice(index, 1), emitObjects);
    },

    setLayerVisible(layerId, visible) {
      if (!LAYERS.some((l) => l.id === layerId)) return;
      if (doc.view.layers[layerId] === visible) return;
      doc.view.layers[layerId] = visible;
      emitView();
    },

    setInterpolation(mode: InterpolationMode) {
      if (mode !== 'linear' && mode !== 'polar') return;
      if (doc.view.interpolation === mode) return;
      doc.view.interpolation = mode;
      emitView();
    },

    resetCamera() {
      emit({ type: 'resetCamera' });
    },

    get canUndo() {
      return past.length > 0;
    },
    get canRedo() {
      return future.length > 0;
    },

    undo() {
      if (gestureBase) pushHistory(takeBase());
      const entry = past.at(-1);
      if (!entry) return;
      past = past.slice(0, -1);
      future = [...future, capture()];
      restore(entry);
    },

    redo() {
      const entry = future.at(-1);
      if (!entry) return;
      future = future.slice(0, -1);
      past = [...past, capture()];
      restore(entry);
    },

    load(input) {
      const parsed = parseDocument(input);
      if (!parsed) throw new TypeError('Invalid scene document');
      const before = takeBase();
      doc = parsed;
      if (!sameContent(before, capture())) pushHistory(before);
      emitLoad();
    },

    snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  return store;
}
