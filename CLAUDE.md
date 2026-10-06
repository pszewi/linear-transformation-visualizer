# CLAUDE.md — conventions for agents working in this repo

Linear Transformation Visualizer: Svelte 5 + Three.js + TypeScript (strict), fully offline.
Read `docs/ARCHITECTURE.md` (once it exists) for the extension guide.

## Layers and dependency direction (enforced by ESLint `no-restricted-imports`)

```
src/core/    pure math. No DOM, no three, no svelte, no katex. Fully unit-tested.
src/state/   document schema, store (Svelte runes), presets, persistence. No three.
src/engine/  three.js renderer + layers. Framework-free (no svelte). Never imports ui/.
src/theme/   scene palette (shared by engine; mirrors styles/tokens.css).
src/ui/      Svelte components/panels. Never imports three; imports engine ONLY via engine/index.ts.
src/styles/  tokens.css (single source of UI design tokens), base.css.
```

## Frozen contracts — do not change without the head agent's approval

`src/core/linalg/matrix.ts`, `src/core/analysis.ts` (types), `src/core/linalg/interpolate.ts`
(interface), `src/core/linalg/decompose.ts` (types), `src/core/format.ts` (signatures),
`src/state/document.ts`, `src/state/events.ts`, `src/state/layers.ts`, `src/state/store.types.ts`,
`src/engine/types.ts`. If a contract is genuinely insufficient, stop and report what you need
and why, instead of working around it.

## Rules

- **Matrices are m×n.** Never hard-code 2×2/3×3 in core; derive dims from `rows/cols`.
  A `Matrix` maps R^cols → R^rows.
- **Numerics:** tolerances only via `src/core/tolerance.ts` (relative). No ad-hoc `1e-10`.
- **Performance:** no allocation in per-frame code paths (use `out` params, preallocated buffers).
  Apply the linear map on the GPU via `object.matrix = frame.matrix4` wherever geometry is just
  "the image of fixed geometry". Render on demand only. Every GPU resource has an owner that
  disposes it.
- **Styling:** only CSS variables from `styles/tokens.css`; no raw colours in components.
  Rounded corners, dark graphite surfaces, accent `--color-accent`. Respect reduced motion.
- **Accessibility:** every control has an accessible name; full keyboard operation; visible focus.
- **Tests:** core changes need Vitest tests in `tests/core/`. Verify math by invariants
  (e.g. ‖Av − λv‖, Σλ = tr A, Πλ = det A), not by restating the implementation.
- Before committing: `npm run check && npx eslint . && npx prettier --check . && npm test`
  must all pass; `npx vite build` must succeed.
- Commit messages: imperative mood, explain _why_. No model identifiers in commits or code.

## Commands

`npm run dev` · `npm run build` · `npm run check` · `npm run lint` · `npm test` · `npm run test:e2e`
(Playwright is pinned to 1.56.1 to match the preinstalled Chromium — do not upgrade it or run
`playwright install`.)
