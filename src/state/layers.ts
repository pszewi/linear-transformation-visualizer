/**
 * FROZEN CONTRACT — layer catalogue (metadata only; no three.js).
 *
 * ui/ reads this to build the Layers panel; engine/ maps each id to a factory in
 * engine/layers/registry.ts. Adding a layer = add an entry here + a factory there.
 */
export interface LayerInfo {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /** Ambient dimensions in which the layer exists. */
  readonly dims: readonly (2 | 3)[];
  readonly defaultVisible: boolean;
}

export const LAYERS: readonly LayerInfo[] = [
  {
    id: 'grid',
    label: 'Grid',
    description: 'Original and transformed coordinate grid (2D) / unit cube and ground grid (3D)',
    dims: [2, 3],
    defaultVisible: true,
  },
  {
    id: 'area',
    label: 'Signed area / volume',
    description: 'Image of the unit square / cube, shaded by the sign of the determinant',
    dims: [2, 3],
    defaultVisible: true,
  },
  {
    id: 'axes',
    label: 'Axes',
    description: 'Coordinate axes, ticks and labels',
    dims: [2, 3],
    defaultVisible: true,
  },
  {
    id: 'basis',
    label: 'Basis vectors',
    description: 'Standard basis e₁, e₂(, e₃) before and after the map',
    dims: [2, 3],
    defaultVisible: true,
  },
  {
    id: 'eigen',
    label: 'Eigenspaces',
    description: 'Real eigenspaces: lines, or planes in 3D',
    dims: [2, 3],
    defaultVisible: true,
  },
  {
    id: 'objects',
    label: 'Vectors',
    description: 'User vectors and their images',
    dims: [2, 3],
    defaultVisible: true,
  },
];

export function layerVisible(layers: Record<string, boolean>, id: string): boolean {
  return layers[id] ?? LAYERS.find((l) => l.id === id)?.defaultVisible ?? false;
}
