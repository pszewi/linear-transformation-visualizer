/**
 * Hard limits on document contents. Shared by the store (which clamps edits) and persistence
 * (which rejects documents that exceed them), so anything the UI can produce also loads.
 */

/** Largest allowed |entry| for matrix entries and vector coordinates. */
export const MAX_ABS_VALUE = 1e6;
/** Maximum number of scene objects (vectors). */
export const MAX_OBJECTS = 16;
/** Maximum length of a user-visible label. */
export const MAX_LABEL_LENGTH = 40;
/** Maximum length of an id string. */
export const MAX_ID_LENGTH = 64;
/** Maximum number of nodes in the transform pipeline. */
export const MAX_TRANSFORMS = 8;
/** Maximum number of rows/cols of a single transform (v1 draws in at most 3 dimensions). */
export const MAX_MATRIX_DIM = 3;
/** Undo history depth. */
export const HISTORY_LIMIT = 100;

/** Clamp a finite number into [−MAX_ABS_VALUE, MAX_ABS_VALUE]; normalises −0 to 0. */
export function clampValue(x: number): number {
  const c = Math.min(MAX_ABS_VALUE, Math.max(-MAX_ABS_VALUE, x));
  return c === 0 ? 0 : c;
}
