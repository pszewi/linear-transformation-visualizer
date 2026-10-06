/**
 * Scene palette for the dark graphite theme. The CSS tokens in styles/tokens.css mirror the
 * shared values (background, accent). Keep the two in sync — the canvas background MUST equal
 * --color-bg so the viewport blends with the UI.
 *
 * Colours are sRGB hex. Engine converts with THREE.Color (colour management on).
 */
export const scenePalette = {
  background: 0x1f1e1c,

  gridOriginal: 0x4a4843,
  gridOriginalOpacity: 0.55,
  gridTransformed: 0xd97757,
  gridTransformedOpacity: 0.55,
  groundGrid: 0x34332f,

  axis: 0x8f8b82,
  tick: 0x8f8b82,
  label: '#bdb9ae',
  labelMuted: '#8f8b82',

  /** Basis vector colours, index i ↔ e_{i+1}. "before" = original e_i, "after" = A e_i. */
  basis: [0xef6370, 0x8fbf7f, 0x8ea4e8] as const,
  basisBefore: [0x7f4048, 0x4f6646, 0x4d5a80] as const,
  basisLabels: ['#ef6370', '#8fbf7f', '#8ea4e8'] as const,

  eigen: 0xe8b75a,
  eigenOpacity: 0.85,
  eigenPlaneOpacity: 0.12,

  areaPositive: 0xd97757,
  areaNegative: 0xc9607e,
  areaOpacity: 0.16,
  /** Per-face opacity of the 3D parallelepiped: up to ~4 faces overlap on screen. */
  areaOpacity3d: 0.07,

  /** User object colours keyed by SceneObject.colorKey; [original, image]. */
  objects: {
    violet: [0xa48be8, 0x7fd0e0],
    teal: [0x6cc4a8, 0xb4e07f],
    rose: [0xe07fa8, 0xf0b47f],
  },
  defaultObjectColor: 'violet',
} as const;

export type ScenePalette = typeof scenePalette;
export type ObjectColorKey = keyof ScenePalette['objects'];
