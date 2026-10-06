/**
 * Draw order shared by all layers. In 2D every material has depth off, so this alone decides
 * what is on top. In 3D depth testing is on; translucent surfaces (which do not write depth)
 * draw last so everything behind them is tinted.
 */
export const ORDER = {
  groundGrid: 0,
  gridOriginal: 1,
  axes: 2,
  areaFill: 3,
  gridTransformed: 4,
  gridAxisImages: 5,
  areaOutline: 6,
  eigenLine: 7,
  basisBefore: 8,
  connector: 9,
  basisAfter: 10,
  objectBefore: 11,
  objectAfter: 12,
  /** 3D translucent surfaces. */
  surface: 20,
  eigenPlane: 21,
} as const;
