/**
 * DEV ONLY — engine playground at /dev/engine.html (vite dev server).
 * Mounts the engine full-screen with a plain-HTML control strip, and exposes
 * `window.__LTV_PLAYGROUND__` so Playwright scripts can drive it.
 *
 * URL params: ?bare (hide the strip), ?dim=3, ?preset=<name>, ?fixtures=stub
 */
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '../src/styles/tokens.css';
import { analyze } from '../src/core/analysis';
import type { Step } from '../src/core/linalg/decompose';
import type { InterpolationMode } from '../src/core/linalg/interpolate';
import { fromRows, type Matrix } from '../src/core/linalg/matrix';
import { mul } from '../src/core/linalg/ops';
import {
  DOCUMENT_VERSION,
  newId,
  type SceneDocument,
  type VectorObject,
} from '../src/state/document';
import { LAYERS, layerVisible } from '../src/state/layers';
import { createEngine } from '../src/engine';
import { devAnalyze } from './eigen-fixture';

type Rows = number[][];
type ShapeKey = '2' | '3' | '3x2' | '2x3';

const c45 = Math.SQRT1_2;
const PRESETS: Record<ShapeKey, Record<string, Rows>> = {
  '2': {
    identity: [
      [1, 0],
      [0, 1],
    ],
    rotation: [
      [c45, -c45],
      [c45, c45],
    ],
    shear: [
      [1, 1],
      [0, 1],
    ],
    reflection: [
      [0, 1],
      [1, 0],
    ],
    stretch: [
      [2, 1],
      [1, 2],
    ],
    singular: [
      [1, 2],
      [0.5, 1],
    ],
    zero: [
      [0, 0],
      [0, 0],
    ],
  },
  '3': {
    identity: [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
    rotation: [
      [c45, -c45, 0],
      [c45, c45, 0],
      [0, 0, 1],
    ],
    shear: [
      [1, 0, 1],
      [0, 1, 0],
      [0, 0, 1],
    ],
    reflection: [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, -1],
    ],
    stretch: [
      [2, 1, 0],
      [1, 2, 0],
      [0, 0, 0.5],
    ],
    singular: [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 0],
    ],
    zero: [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ],
  },
  '3x2': {
    identity: [
      [1, 0],
      [0, 1],
      [0, 0],
    ],
    tilt: [
      [1, 0],
      [0, 1],
      [0.6, 0.8],
    ],
    singular: [
      [1, 2],
      [1, 2],
      [0, 0],
    ],
    zero: [
      [0, 0],
      [0, 0],
      [0, 0],
    ],
  },
  '2x3': {
    project: [
      [1, 0, 0],
      [0, 1, 0],
    ],
    oblique: [
      [1, 0, 0.5],
      [0, 1, 0.5],
    ],
    zero: [
      [0, 0, 0],
      [0, 0, 0],
    ],
  },
};

const params = new URLSearchParams(location.search);
if (params.has('bare')) document.body.classList.add('bare');

let fixtures = params.get('fixtures') !== 'stub';
const engine = createEngine({ analyze: (m) => (fixtures ? devAnalyze(m) : analyze(m)) });
const viewport = document.getElementById('viewport');
if (!viewport) throw new Error('#viewport missing');
engine.mount(viewport);

let shapeKey: ShapeKey =
  params.get('dim') === '3' ? '3' : ((params.get('shape') as ShapeKey) ?? '2');
if (!(shapeKey in PRESETS)) shapeKey = '2';
let current: Rows = PRESETS[shapeKey].identity ?? Object.values(PRESETS[shapeKey])[0];
let objects: VectorObject[] = [];
const layers: Record<string, boolean> = {};
let interpolation: InterpolationMode = 'linear';
let animate = true;

function doc(): SceneDocument {
  return {
    version: DOCUMENT_VERSION,
    transforms: [{ id: newId('t'), label: 'A', rows: current }],
    objects,
    view: { layers: { ...layers }, interpolation },
  };
}

function domainDim(): number {
  return current[0].length;
}

function load(key: ShapeKey): void {
  shapeKey = key;
  const presets = PRESETS[key];
  current = presets.identity ?? Object.values(presets)[0];
  objects = [];
  engine.dispatch({ type: 'load', doc: doc() });
  buildStrip();
}

function setMatrix(rows: Rows, anim = animate): void {
  current = rows;
  engine.dispatch({ type: 'matrix', matrix: fromRows(rows), animate: anim });
}

function preset(name: string, anim = animate): void {
  const rows = PRESETS[shapeKey][name];
  if (rows) setMatrix(rows, anim);
}

const COLOR_KEYS = ['violet', 'teal', 'rose'] as const;
function addVector(coords?: number[]): void {
  const n = domainDim();
  const v =
    coords ?? Array.from({ length: n }, () => Math.round((Math.random() * 4 - 2) * 2) / 2 || 1);
  objects = [
    ...objects,
    {
      id: newId('v'),
      kind: 'vector',
      visible: true,
      coords: v.slice(0, n),
      colorKey: COLOR_KEYS[objects.length % COLOR_KEYS.length],
    },
  ];
  engine.dispatch({ type: 'objects', objects });
}

function clearVectors(): void {
  objects = [];
  engine.dispatch({ type: 'objects', objects });
}

function setLayer(id: string, visible: boolean): void {
  layers[id] = visible;
  engine.dispatch({ type: 'view', view: { layers: { ...layers }, interpolation } });
}

function setInterpolation(mode: InterpolationMode): void {
  interpolation = mode;
  engine.dispatch({ type: 'view', view: { layers: { ...layers }, interpolation } });
}

function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

interface DragResult {
  frames: number;
  medianFrameMs: number;
  p95FrameMs: number;
  medianIntervalMs: number;
  renders: number;
}

/** Dispatch a live (animate:false) matrix every frame for `ms`; measure engine frame time. */
function drag(ms = 3000): Promise<DragResult> {
  const dbg = window.__LTV_DEBUG__;
  const n = Math.max(current.length, current[0].length);
  const rows = current.length;
  const cols = current[0].length;
  const samples: number[] = [];
  const intervals: number[] = [];
  const renders0 = dbg?.renders ?? 0;
  const out = new Float64Array(rows * cols);
  return new Promise((resolve) => {
    const t0 = performance.now();
    let last = t0;
    let lastRenders = renders0;
    const frame = (now: number): void => {
      const t = (now - t0) / 1000;
      const a = t * Math.PI;
      const s = 1 + 0.35 * Math.sin(t * 4);
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          // rotation in the xy-plane, scaled, embedded into the shape
          let v = i === j ? 1 : 0;
          if (i < 2 && j < 2) {
            const c = Math.cos(a) * s;
            const sn = Math.sin(a) * s;
            v = i === j ? c : i === 0 ? -sn : sn;
          } else if (n === 3 && i === 2 && j === 2) v = 1 + 0.5 * Math.sin(t * 3);
          out[i * cols + j] = v;
        }
      }
      engine.dispatch({ type: 'matrix', matrix: { rows, cols, data: out }, animate: false });
      if (dbg && dbg.renders !== lastRenders) {
        samples.push(dbg.lastFrameMs);
        lastRenders = dbg.renders;
      }
      intervals.push(now - last);
      last = now;
      if (now - t0 < ms) requestAnimationFrame(frame);
      else {
        const sorted = [...samples].sort((x, y) => x - y);
        resolve({
          frames: samples.length,
          medianFrameMs: median(samples),
          p95FrameMs: sorted[Math.floor(sorted.length * 0.95)] ?? NaN,
          medianIntervalMs: median(intervals.slice(1)),
          renders: (dbg?.renders ?? 0) - renders0,
        });
      }
    };
    requestAnimationFrame(frame);
  });
}

function demoSteps(): Step[] {
  if (current.length !== current[0].length) return [];
  const n = current.length;
  const a = fromRows(current);
  // A "decomposition" for demo purposes: first a diagonal stretch, then the rest.
  const diag = fromRows(
    Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1.5 : 0))),
  );
  const rest = fromRows(
    Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => a.data[i * n + j] / 1.5),
    ),
  );
  return [
    { label: 'Stretch', factor: diag, cumulative: diag },
    { label: 'Rest', factor: rest, cumulative: mul(rest, diag) },
  ];
}

// ── control strip ──────────────────────────────────────────────────────────

const strip = document.getElementById('strip');
const status = document.createElement('span');
status.id = 'status';

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function group(legend: string, ...children: HTMLElement[]): HTMLFieldSetElement {
  const f = document.createElement('fieldset');
  const l = document.createElement('legend');
  l.textContent = legend;
  f.append(l, ...children);
  return f;
}

function checkbox(label: string, checked: boolean, onChange: (v: boolean) => void): HTMLElement {
  const wrap = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  wrap.append(input, ` ${label}`);
  return wrap;
}

function buildStrip(): void {
  if (!strip) return;
  strip.replaceChildren(
    group(
      'shape',
      ...(['2', '3', '3x2', '2x3'] as const).map((k) =>
        button(k === '2' ? '2D' : k === '3' ? '3D' : k.replace('x', '×'), () => load(k)),
      ),
    ),
    group(
      'preset',
      ...Object.keys(PRESETS[shapeKey]).map((name) => button(name, () => preset(name))),
      checkbox('animate', animate, (v) => (animate = v)),
    ),
    group(
      'layers',
      ...LAYERS.map((l) => checkbox(l.id, layerVisible(layers, l.id), (v) => setLayer(l.id, v))),
    ),
    group(
      'tests',
      button('drag 3 s', () => {
        status.textContent = 'dragging…';
        void drag().then((r) => (status.textContent = JSON.stringify(r)));
      }),
      button('play steps', () => engine.dispatch({ type: 'playSteps', steps: demoSteps() })),
      button('reset camera', () => engine.dispatch({ type: 'resetCamera' })),
      button('add vector', () => addVector()),
      button('clear vectors', clearVectors),
      checkbox('eigen fixtures', fixtures, (v) => {
        fixtures = v;
        setMatrix(current, false);
      }),
      (() => {
        const sel = document.createElement('select');
        sel.setAttribute('aria-label', 'Interpolation');
        for (const m of ['linear', 'polar'])
          sel.append(new Option(m, m, false, m === interpolation));
        sel.addEventListener('change', () => setInterpolation(sel.value as InterpolationMode));
        return sel;
      })(),
    ),
    status,
  );
}

function stats(): void {
  const d = window.__LTV_DEBUG__;
  if (d && !status.textContent?.startsWith('{')) {
    const i = d.info();
    status.textContent = `renders ${d.renders} · geo ${i.geometries} · tex ${i.textures} · prog ${i.programs} · calls ${i.calls}`;
  }
}
setInterval(stats, 500);

load(shapeKey);
const initialPreset = params.get('preset');
if (initialPreset) preset(initialPreset, false);

/** Scripting surface for Playwright. */
const api = {
  engine,
  load,
  preset,
  setMatrix: (rows: Rows, anim = false) => setMatrix(rows, anim),
  matrix: (m: Matrix, anim = false) =>
    engine.dispatch({ type: 'matrix', matrix: m, animate: anim }),
  addVector,
  clearVectors,
  setLayer,
  setInterpolation,
  drag,
  playSteps: () => engine.dispatch({ type: 'playSteps', steps: demoSteps() }),
  resetCamera: () => engine.dispatch({ type: 'resetCamera' }),
  setFixtures: (v: boolean) => {
    fixtures = v;
    setMatrix(current, false);
  },
};
declare global {
  interface Window {
    __LTV_PLAYGROUND__?: typeof api;
  }
}
window.__LTV_PLAYGROUND__ = api;
