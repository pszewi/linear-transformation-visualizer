# Architecture

This document explains how the app is put together and, above all, **how to extend it**.
Conventions and hard rules for contributors (human or agent) live in [`CLAUDE.md`](../CLAUDE.md).

## The four layers

```
 ┌───────────────────────────── ui/ (Svelte 5) ──────────────────────────────┐
 │  App · Toolbar · Sidebar(panel registry) · components · panels            │
 └───────────┬──────────────────────────────────────────────┬────────────────┘
             │ actions (setEntry, applyPreset, …)            │ engine.mount / dispatch
             ▼                                               ▼
 ┌──────── state/ ────────┐   SceneEvent stream    ┌──────── engine/ (Three.js) ────────┐
 │ SceneDocument (JSON)   │ ─────────────────────▶ │ Engine · camera rigs · Animator    │
 │ store (runes), presets │                        │ layer registry → Layer plugins     │
 │ history, persistence   │                        │ primitives (fat lines, arrows)     │
 └───────────┬────────────┘                        └────────────────┬───────────────────┘
             │                                                      │
             ▼                                                      ▼
 ┌──────────────────────────────── core/ (pure TS) ─────────────────────────────────────┐
 │ Matrix (m×n) · ops · LU · RREF · eigen · analysis · interpolators · decompositions   │
 └──────────────────────────────────────────────────────────────────────────────────────┘
```

- **`core/`** is pure math: no DOM, no Three.js, no Svelte. Everything is unit-tested by invariants.
- **`state/`** holds the single source of truth, a plain-JSON `SceneDocument`. The store mutates it
  through actions and emits a one-way stream of `SceneEvent`s.
- **`engine/`** consumes `SceneEvent`s and renders. It never reads the store and never imports Svelte.
- **`ui/`** renders the document and calls store actions. It never touches Three.js.

ESLint (`no-restricted-imports` in `eslint.config.js`) enforces these boundaries.

## Data flow of one edit

1. The user drags a matrix cell → `store.setEntry(i, j, v, 'live')`.
2. The store updates `doc` (Svelte re-renders only the affected cells), derives `matrix` and
   `analysis`, and emits `{ type: 'matrix', matrix, animate: false }`.
3. `Engine.dispatch` marks the frame dirty. On the next animation frame it computes the current
   matrix, embeds it as a `Matrix4`, runs `analyze()` once, and calls `layer.update(frame)` on each
   layer.
4. Layers that draw _the image of fixed geometry_ (grid, unit square/cube) do not touch vertices:
   they set `object.matrix = frame.matrix4`, and the GPU applies the map. Only arrows, labels and
   eigenspaces are recomputed on the CPU.
5. Nothing changed → no render. The loop sleeps.

On release, `'end'` adds one undo entry. Typed values and presets use `'commit'`, which animates
through the selected `Interpolator`.

## Extension recipes

### Add a preset

`state/presets.ts`: `registerPreset({ id, name, shape: { rows, cols }, rows, description })`.
The Presets panel picks it up automatically for matching shapes.

### Add a layer (something drawn in the scene)

1. Add a `LayerInfo` entry to `state/layers.ts` (id, label, dims, default visibility). The Layers
   panel lists it automatically.
2. Implement `Layer` (`engine/types.ts`) in `engine/layers/YourLayer.ts`:
   - `init`: build GPU resources
   - `update(frame)`: react to changes, without allocating
   - `setVisible`
   - `dispose`: free everything
3. Register the factory under the same id in `engine/layers/registry.ts`.

### Add a kind of scene object (polygon, mesh, plane, …)

1. Add a member to the `SceneObject` union in `state/document.ts`, then bump `DOCUMENT_VERSION`
   and add a migration in `state/persistence.ts`.
2. Add a renderer for the kind inside the objects layer (`engine/layers/`), pooled, not recreated.
3. Add an editor row in the Vectors/Objects panel (`ui/panels/`).

### Add a sidebar panel

Create a Svelte component in `ui/panels/` and register it in `ui/panels/registry.ts` with
`{ id, title, order, defaultOpen, component, when? }`.

### Composition / sequences of maps

`SceneDocument.transforms` is already a pipeline. The effective map is `T_k ⋯ T_1`
(`effectiveMatrix`). v1 keeps exactly one node. A sequence feature needs:

- a UI to add and reorder nodes, and to select the active one
- the `playSteps` event, which the engine already supports: it animates identity → step 1 → … → step k

### Decompositions (SVD, QR, eigendecomposition, …)

Implement `Decomposition` (`core/linalg/decompose.ts`). `steps(m)` returns the factors and the
cumulative products, as in `A = F_k ⋯ F_1`. Register it from `core/linalg/decompositions/index.ts`.
To animate it, dispatch `{ type: 'playSteps', steps }`. Polar is already implemented and doubles as
the "polar" interpolation mode.

### Non-square maps (2×3, 3×2)

Everything below the UI is already m×n:

- `Matrix` maps R^cols → R^rows.
- `analyze` leaves square-only fields (`det`, `eigen`, …) `undefined`.
- `ambientDim(shape) = max(rows, cols)`.
- The engine zero-pads domain vectors and embeds A into a `Matrix4`.

To ship it, allow non-square shapes in the store's `setDimension`/shape picker, add presets, and
let the UI hide square-only rows (the Analysis panel already does).

### Heavy computation

If a future feature needs heavy numerics (large n, dense sampling of nonlinear maps), `core/` is
the seam. It is pure and sits behind typed functions, so a WebAssembly implementation can replace
it without touching `state/`, `engine/` or `ui/`. At n ≤ 3 this would be slower, because the cost
of each JS↔WASM call dominates.

## Numerics

All tolerances come from `core/tolerance.ts` and are relative to ‖A‖∞. Eigenvalues closer than
`eigenClusterTolFor(A)` are treated as one repeated eigenvalue. Eigenspaces are null spaces of
(A − λI), so the geometric multiplicity is reported and can be smaller than the algebraic one
(defective matrices, e.g. shears).
