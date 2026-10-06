import { describe, expect, it, vi } from 'vitest';
import { defaultDocument, type SceneDocument } from '../../src/state/document';
import type { SceneEvent } from '../../src/state/events';
import { MAX_LABEL_LENGTH, MAX_OBJECTS } from '../../src/state/limits';
import {
  createAutosave,
  initialDocument,
  loadFromStorage,
  parseDocument,
  parseSceneFile,
  saveToStorage,
  serializeScene,
  STORAGE_KEY,
  validateDocument,
  type KeyValueStorage,
} from '../../src/state/persistence';

function validDoc(): SceneDocument {
  return {
    version: 1,
    transforms: [
      {
        id: 't-1',
        label: 'A',
        rows: [
          [1, 2],
          [3, 4],
        ],
      },
    ],
    objects: [
      { id: 'v-1', kind: 'vector', visible: true, coords: [1, -1], label: 'v₁', colorKey: 'teal' },
    ],
    view: { layers: { grid: false }, interpolation: 'polar' },
  };
}

/** Deep-clone and modify a valid document. */
function mutated(change: (doc: Record<string, unknown> & SceneDocument) => void): unknown {
  const doc = structuredClone(validDoc()) as Record<string, unknown> & SceneDocument;
  change(doc);
  return doc;
}

class MemoryStorage implements KeyValueStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

describe('parseDocument', () => {
  it('round-trips valid documents', () => {
    expect(parseDocument(validDoc())).toEqual(validDoc());
    expect(parseDocument(JSON.parse(JSON.stringify(validDoc())))).toEqual(validDoc());
    const d3 = defaultDocument(3);
    expect(parseDocument(d3)).toEqual(d3);
  });

  it('accepts non-square documents', () => {
    const doc = mutated((d) => {
      d.transforms[0].rows = [
        [1, 0, 2],
        [0, 1, 0],
      ];
      d.objects[0].coords = [1, 2, 3];
    });
    expect(parseDocument(doc)).not.toBeNull();
  });

  it('drops unknown fields and unknown layer ids', () => {
    const doc = mutated((d) => {
      d.extra = 'nope';
      d.view.layers.unknownLayer = true;
    });
    const parsed = parseDocument(doc);
    expect(parsed).toEqual(validDoc());
    expect(parsed && 'extra' in parsed).toBe(false);
  });

  it.each([
    ['null', null],
    ['a string', 'hello'],
    ['an array', []],
    ['missing version', mutated((d) => delete (d as Partial<SceneDocument>).version)],
    ['future version', mutated((d) => (d.version = 99 as 1))],
    ['fractional version', mutated((d) => (d.version = 0.5 as 1))],
    ['no transforms', mutated((d) => (d.transforms = []))],
    ['NaN entry', mutated((d) => (d.transforms[0].rows[0][0] = Number.NaN))],
    ['Infinity entry', mutated((d) => (d.transforms[0].rows[1][1] = Infinity))],
    ['string entry', mutated((d) => ((d.transforms[0].rows[0] as unknown[])[1] = '2'))],
    ['oversized entry', mutated((d) => (d.transforms[0].rows[0][0] = 1e7))],
    ['ragged rows', mutated((d) => (d.transforms[0].rows[1] = [1]))],
    ['4×4 matrix', mutated((d) => (d.transforms[0].rows = Array.from({ length: 4 }, () => [1, 0, 0, 0])))], // prettier-ignore
    ['1×1 matrix', mutated((d) => (d.transforms[0].rows = [[1]]))],
    ['long label', mutated((d) => (d.transforms[0].label = 'x'.repeat(MAX_LABEL_LENGTH + 1)))],
    ['empty id', mutated((d) => ((d.transforms[0] as { id: string }).id = ''))],
    ['unknown kind', mutated((d) => ((d.objects[0] as { kind: string }).kind = 'polygon'))],
    ['wrong coords length', mutated((d) => (d.objects[0].coords = [1, 2, 3]))],
    ['NaN coords', mutated((d) => (d.objects[0].coords = [Number.NaN, 0]))],
    ['non-boolean visible', mutated((d) => ((d.objects[0] as { visible: unknown }).visible = 1))],
    ['unknown colour', mutated((d) => (d.objects[0].colorKey = 'chartreuse'))],
    ['duplicate ids', mutated((d) => d.objects.push({ ...d.objects[0] }))],
    ['too many objects', mutated((d) => (d.objects = Array.from({ length: MAX_OBJECTS + 1 }, (_, k) => ({ ...d.objects[0], id: `v${k}` }))))], // prettier-ignore
    ['bad interpolation', mutated((d) => ((d.view as { interpolation: string }).interpolation = 'cubic'))], // prettier-ignore
    ['non-boolean layer', mutated((d) => ((d.view.layers as Record<string, unknown>).grid = 'yes'))], // prettier-ignore
    ['missing view', mutated((d) => delete (d as Partial<SceneDocument>).view)],
    [
      'non-composable pipeline',
      mutated((d) => d.transforms.push({ id: 't-2', label: 'B', rows: [[1, 2, 3]] })),
    ],
  ])('rejects %s', (_name, input) => {
    expect(parseDocument(input)).toBeNull();
    expect(validateDocument(input).ok).toBe(false);
  });

  it('explains rejections', () => {
    const result = validateDocument(mutated((d) => (d.transforms[0].rows[0][0] = Number.NaN)));
    expect(result).toEqual({ ok: false, error: expect.stringContaining('finite') });
  });
});

describe('scene files', () => {
  it('round-trips, including unicode labels', () => {
    const text = serializeScene(validDoc());
    expect(text.endsWith('\n')).toBe(true);
    expect(parseSceneFile(text)).toEqual(validDoc());
  });

  it('rejects garbage and oversized files', () => {
    expect(parseSceneFile('')).toBeNull();
    expect(parseSceneFile('not json')).toBeNull();
    expect(parseSceneFile('{"version":1}')).toBeNull();
    expect(parseSceneFile(' '.repeat(300_000) + serializeScene(validDoc()))).toBeNull();
  });
});

describe('storage', () => {
  it('saves and loads', () => {
    const storage = new MemoryStorage();
    expect(saveToStorage(storage, validDoc())).toBe(true);
    expect(loadFromStorage(storage)).toEqual(validDoc());
  });

  it('survives throwing or corrupt storage', () => {
    const throwing: KeyValueStorage = {
      getItem() {
        throw new Error('denied');
      },
      setItem() {
        throw new Error('quota');
      },
    };
    expect(loadFromStorage(throwing)).toBeNull();
    expect(saveToStorage(throwing, validDoc())).toBe(false);
    const corrupt = new MemoryStorage();
    corrupt.setItem(STORAGE_KEY, '{not json');
    expect(loadFromStorage(corrupt)).toBeNull();
    expect(loadFromStorage(null)).toBeNull();
  });

  it('autosave debounces and ignores camera events', () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const listeners = new Set<(e: SceneEvent) => void>();
    let current = validDoc();
    const autosave = createAutosave(
      {
        snapshot: () => current,
        subscribe: (l) => {
          listeners.add(l);
          return () => listeners.delete(l);
        },
      },
      storage,
      300,
    );
    const fire = (e: SceneEvent) => listeners.forEach((l) => l(e));

    fire({ type: 'resetCamera' });
    vi.advanceTimersByTime(1000);
    expect(storage.data.size).toBe(0);

    fire({ type: 'objects', objects: [] });
    vi.advanceTimersByTime(200);
    current = defaultDocument(3);
    fire({ type: 'objects', objects: [] });
    vi.advanceTimersByTime(200);
    expect(storage.data.size).toBe(0);
    vi.advanceTimersByTime(200);
    expect(loadFromStorage(storage)).toEqual(current);

    autosave.dispose();
    expect(listeners.size).toBe(0);
    vi.useRealTimers();
  });
});

describe('initialDocument', () => {
  it('prefers storage, then the default 2D scene', () => {
    const storage = new MemoryStorage();
    const stored = defaultDocument(3);
    saveToStorage(storage, stored);
    expect(initialDocument(storage)).toMatchObject({ source: 'storage', doc: stored });
    const fallback = initialDocument(new MemoryStorage());
    expect(fallback.source).toBe('default');
    expect(fallback.doc.transforms[0].rows).toEqual([
      [1, 0],
      [0, 1],
    ]);
  });
});
