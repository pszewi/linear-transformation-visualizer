import { describe, expect, it } from 'vitest';
import { toRows } from '../../src/core/linalg/matrix';
import { defaultDocument, type SceneDocument } from '../../src/state/document';
import type { SceneEvent } from '../../src/state/events';
import { HISTORY_LIMIT, MAX_ABS_VALUE, MAX_OBJECTS } from '../../src/state/limits';
import { getPreset, presetsFor } from '../../src/state/presets';
import { createStore } from '../../src/state/store.svelte';

function setup(initial?: SceneDocument) {
  const store = createStore(initial ? { initial } : {});
  const events: SceneEvent[] = [];
  store.subscribe((e) => events.push(e));
  return { store, events };
}

const matrixEvents = (events: SceneEvent[]) =>
  events.filter((e): e is Extract<SceneEvent, { type: 'matrix' }> => e.type === 'matrix');

describe('store basics', () => {
  it('starts as the 2D identity', () => {
    const { store } = setup();
    expect(store.dim).toBe(2);
    expect(store.shape).toEqual({ rows: 2, cols: 2 });
    expect(toRows(store.matrix)).toEqual([
      [1, 0],
      [0, 1],
    ]);
    expect(store.analysis.det).toBe(1);
    expect(store.canUndo).toBe(false);
  });

  it('derives matrix and analysis from the document', () => {
    const { store } = setup();
    store.setEntry(0, 1, 3, 'commit');
    expect(toRows(store.matrix)).toEqual([
      [1, 3],
      [0, 1],
    ]);
    store.setEntry(1, 1, 5, 'commit');
    expect(store.analysis.det).toBe(5);
    expect(store.analysis.trace).toBe(6);
  });

  it('ignores invalid edits and clamps huge values', () => {
    const { store, events } = setup();
    store.setEntry(5, 0, 1, 'commit');
    store.setEntry(0, 0, Number.NaN, 'commit');
    store.setEntry(0, 0, Infinity, 'commit');
    expect(events).toEqual([]);
    store.setEntry(0, 0, 1e12, 'commit');
    expect(store.doc.transforms[0].rows[0][0]).toBe(MAX_ABS_VALUE);
  });

  it('snapshot is a deep plain copy', () => {
    const { store } = setup();
    const snap = store.snapshot();
    snap.transforms[0].rows[0][0] = 42;
    expect(store.doc.transforms[0].rows[0][0]).toBe(1);
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
  });
});

describe('edit phases → events', () => {
  it('live emits matrix without animation and no history', () => {
    const { store, events } = setup();
    store.setEntry(0, 0, 1.5, 'live');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'matrix', animate: false });
    expect(store.canUndo).toBe(false);
  });

  it('end emits matrix without animation and records history', () => {
    const { store, events } = setup();
    store.setEntry(0, 0, 2, 'end');
    expect(events[0]).toMatchObject({ type: 'matrix', animate: false });
    expect(store.canUndo).toBe(true);
  });

  it('commit emits an animated matrix and records history', () => {
    const { store, events } = setup();
    store.setEntry(0, 0, 2, 'commit');
    expect(events).toHaveLength(1);
    const [e] = matrixEvents(events);
    expect(e.animate).toBe(true);
    expect(Array.from(e.matrix.data)).toEqual([2, 0, 0, 1]);
    expect(store.canUndo).toBe(true);
  });

  it('a commit that changes nothing emits nothing and records nothing', () => {
    const { store, events } = setup();
    store.setEntry(0, 0, 1, 'commit');
    expect(events).toEqual([]);
    expect(store.canUndo).toBe(false);
  });

  it('events are emitted synchronously, after the state changed', () => {
    const store = createStore();
    let seen = Number.NaN;
    store.subscribe(() => {
      seen = store.doc.transforms[0].rows[1][0];
    });
    store.setEntry(1, 0, 0.25, 'live');
    expect(seen).toBe(0.25);
  });

  it('unsubscribe stops delivery', () => {
    const store = createStore();
    const events: SceneEvent[] = [];
    const off = store.subscribe((e) => events.push(e));
    off();
    store.setEntry(0, 0, 3, 'commit');
    expect(events).toEqual([]);
  });

  it('setMatrix commits with animation', () => {
    const { store, events } = setup();
    store.setMatrix([
      [0, -1],
      [1, 0],
    ]);
    expect(matrixEvents(events)[0].animate).toBe(true);
    store.setMatrix([[1, 2, 3]]); // wrong shape: ignored
    expect(events).toHaveLength(1);
  });

  it('view changes emit view events and are not undoable', () => {
    const { store, events } = setup();
    store.setLayerVisible('grid', false);
    store.setInterpolation('polar');
    expect(events.map((e) => e.type)).toEqual(['view', 'view']);
    expect(store.doc.view).toEqual({ layers: { grid: false }, interpolation: 'polar' });
    expect(store.canUndo).toBe(false);
    store.setLayerVisible('no-such-layer', true);
    expect(events).toHaveLength(2);
  });

  it('resetCamera emits resetCamera', () => {
    const { store, events } = setup();
    store.resetCamera();
    expect(events).toEqual([{ type: 'resetCamera' }]);
  });
});

describe('gestures and history', () => {
  it('a drag gesture is ONE history entry', () => {
    const { store, events } = setup();
    for (const v of [1.1, 1.4, 1.9, 2.3]) store.setEntry(0, 0, v, 'live');
    store.setEntry(0, 0, 2.5, 'end');
    expect(events).toHaveLength(5);
    expect(events.every((e) => e.type === 'matrix' && !e.animate)).toBe(true);

    store.undo();
    expect(store.doc.transforms[0].rows[0][0]).toBe(1);
    expect(store.canUndo).toBe(false);
    expect(store.canRedo).toBe(true);
  });

  it('undo/redo emit animated matrix events', () => {
    const { store, events } = setup();
    store.setEntry(0, 1, 2, 'commit');
    events.length = 0;
    store.undo();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'matrix', animate: true });
    expect(store.doc.transforms[0].rows[0][1]).toBe(0);
    store.redo();
    expect(store.doc.transforms[0].rows[0][1]).toBe(2);
    expect(matrixEvents(events)[1].animate).toBe(true);
  });

  it('a new edit clears the redo stack', () => {
    const { store } = setup();
    store.setEntry(0, 0, 2, 'commit');
    store.undo();
    store.setEntry(0, 0, 3, 'commit');
    expect(store.canRedo).toBe(false);
  });

  it('a gesture left without "end" is folded into the next entry', () => {
    const { store } = setup();
    store.setEntry(0, 0, 4, 'live');
    store.setEntry(1, 1, 7, 'commit');
    store.undo();
    expect(store.doc.transforms[0].rows).toEqual([
      [1, 0],
      [0, 1],
    ]);
  });

  it('caps history at the limit', () => {
    const { store } = setup();
    for (let k = 0; k < HISTORY_LIMIT + 20; k++) store.setEntry(0, 0, k + 2, 'commit');
    let undos = 0;
    while (store.canUndo) {
      store.undo();
      undos += 1;
    }
    expect(undos).toBe(HISTORY_LIMIT);
  });

  it('undo restores objects and emits objects events', () => {
    const { store, events } = setup();
    const id = store.addVector();
    expect(id).not.toBe('');
    events.length = 0;
    store.undo();
    expect(store.doc.objects).toEqual([]);
    expect(events).toEqual([{ type: 'objects', objects: [] }]);
  });
});

describe('dimension, presets and loading', () => {
  it('setDimension emits load with the identity of that size and drops objects', () => {
    const { store, events } = setup();
    store.addVector();
    events.length = 0;
    store.setDimension(3);
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e.type).toBe('load');
    if (e.type !== 'load') return;
    expect(e.doc.transforms[0].rows).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
    expect(e.doc.objects).toEqual([]);
    expect(store.dim).toBe(3);
  });

  it('setDimension to the current dimension is a no-op', () => {
    const { store, events } = setup();
    store.setEntry(0, 0, 3, 'commit');
    events.length = 0;
    store.setDimension(2);
    expect(events).toEqual([]);
    expect(store.doc.transforms[0].rows[0][0]).toBe(3);
  });

  it('undo across a shape change emits load', () => {
    const { store, events } = setup();
    store.setEntry(0, 0, 3, 'commit');
    store.setDimension(3);
    events.length = 0;
    store.undo();
    expect(events.map((e) => e.type)).toEqual(['load']);
    expect(store.dim).toBe(2);
    expect(store.doc.transforms[0].rows[0][0]).toBe(3);
  });

  it('applyPreset commits the preset matrix with animation', () => {
    const { store, events } = setup();
    store.applyPreset('2d-rotate-45');
    const preset = getPreset('2d-rotate-45');
    expect(store.doc.transforms[0].rows).toEqual(preset?.rows);
    expect(matrixEvents(events)[0].animate).toBe(true);
    expect(store.canUndo).toBe(true);
  });

  it('applyPreset of another shape reloads', () => {
    const { store, events } = setup();
    store.applyPreset('3d-cyclic');
    expect(events.map((e) => e.type)).toEqual(['load']);
    expect(store.dim).toBe(3);
  });

  it('load validates input', () => {
    const { store, events } = setup();
    expect(() => store.load({ version: 1 })).toThrow();
    expect(events).toEqual([]);
    const doc = defaultDocument(3);
    store.load(doc);
    expect(events.map((e) => e.type)).toEqual(['load']);
    expect(store.dim).toBe(3);
  });
});

describe('objects', () => {
  it('adds vectors with default coords, labels and colours', () => {
    const { store, events } = setup();
    store.addVector();
    store.addVector([2, -1]);
    expect(store.doc.objects.map((o) => o.coords)).toEqual([
      [1, 1],
      [2, -1],
    ]);
    expect(store.doc.objects.map((o) => o.label)).toEqual(['v₁', 'v₂']);
    expect(store.doc.objects[0].colorKey).not.toBe(store.doc.objects[1].colorKey);
    expect(events.map((e) => e.type)).toEqual(['objects', 'objects']);
  });

  it('caps the number of objects', () => {
    const { store } = setup();
    for (let k = 0; k < MAX_OBJECTS; k++) store.addVector();
    expect(store.addVector()).toBe('');
    expect(store.doc.objects).toHaveLength(MAX_OBJECTS);
  });

  it('updates with phases; a coordinate drag is one entry', () => {
    const { store, events } = setup();
    const id = store.addVector();
    events.length = 0;
    store.updateObject(id, { coords: [1.2, 1] }, 'live');
    store.updateObject(id, { coords: [1.5, 1] }, 'live');
    store.updateObject(id, { coords: [2, 1] }, 'end');
    expect(events.map((e) => e.type)).toEqual(['objects', 'objects', 'objects']);
    store.undo();
    expect(store.doc.objects[0].coords).toEqual([1, 1]);
  });

  it('rejects bad patches', () => {
    const { store, events } = setup();
    const id = store.addVector();
    events.length = 0;
    store.updateObject(id, { coords: [1, 2, 3] }, 'commit');
    store.updateObject(id, { coords: [Number.NaN, 1] }, 'commit');
    store.updateObject(id, { colorKey: 'chartreuse' }, 'commit');
    expect(events).toEqual([]);
    store.updateObject(id, { visible: false }, 'commit');
    expect(store.doc.objects[0].visible).toBe(false);
  });

  it('removes objects', () => {
    const { store } = setup();
    const id = store.addVector();
    store.removeObject(id);
    expect(store.doc.objects).toEqual([]);
    store.undo();
    expect(store.doc.objects).toHaveLength(1);
  });
});

describe('presets', () => {
  it('every preset has the shape it claims', () => {
    for (const n of [2, 3]) {
      const list = presetsFor({ rows: n, cols: n });
      expect(list.length).toBeGreaterThanOrEqual(10);
      for (const p of list) {
        expect(p.rows).toHaveLength(n);
        for (const r of p.rows) expect(r).toHaveLength(n);
      }
    }
  });

  it('rotations are orthogonal with det 1', () => {
    const { store } = setup();
    for (const id of ['2d-rotate-45', '2d-rotate-90']) {
      store.applyPreset(id);
      expect(store.analysis.det).toBeCloseTo(1, 12);
    }
    store.applyPreset('3d-cyclic');
    expect(store.analysis.det).toBeCloseTo(1, 12);
  });
});
