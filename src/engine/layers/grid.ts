/**
 * Grid layer.
 *  2D: static original grid (muted) + the SAME geometry under matrix4 (accent), with the
 *      images of the coordinate axes emphasised.
 *  3D: faint static ground grid in the xy-plane, the original unit cube (faint) and its image.
 *      For maps from R² (3×2) the image of the domain lattice is drawn instead of the cube.
 * Everything here is built once; the map is applied on the GPU.
 */
import type { FrameState, LayerContext } from '../types';
import { ORDER } from '../renderOrder';
import { staticSegments, type Segments } from '../primitives/lines';
import { applyMap, BaseLayer, makeMapped } from './BaseLayer';

/** Half-extent of the 2D grid (world units). Zoom limits keep the edges out of view. */
export const GRID_2D_RANGE = 50;
const GROUND_RANGE = 5;
const LATTICE_3D_RANGE = 2;

/** Lines x = i and y = i for integer |i| ≤ range, spanning [−range, range] (optionally no i = 0). */
export function latticeSegments(range: number, skipAxes = false): Float32Array {
  const out: number[] = [];
  for (let i = -range; i <= range; i++) {
    if (skipAxes && i === 0) continue;
    out.push(i, -range, 0, i, range, 0);
    out.push(-range, i, 0, range, i, 0);
  }
  return new Float32Array(out);
}

// prettier-ignore
const CUBE_EDGES = new Float32Array([
  0, 0, 0, 1, 0, 0,  0, 1, 0, 1, 1, 0,  0, 0, 1, 1, 0, 1,  0, 1, 1, 1, 1, 1,
  0, 0, 0, 0, 1, 0,  1, 0, 0, 1, 1, 0,  0, 0, 1, 0, 1, 1,  1, 0, 1, 1, 1, 1,
  0, 0, 0, 0, 0, 1,  1, 0, 0, 1, 0, 1,  0, 1, 0, 0, 1, 1,  1, 1, 0, 1, 1, 1,
]);

export class GridLayer extends BaseLayer {
  readonly id = 'grid';
  private mapped: Segments[] = [];
  private cube: Segments | null = null;
  private lattice: Segments | null = null;

  protected build(ctx: LayerContext): void {
    const p = ctx.palette;
    if (ctx.dim === 2) {
      const lattice = this.geometry(staticSegments(latticeSegments(GRID_2D_RANGE)));
      this.segments(
        lattice,
        { color: p.gridOriginal, width: 1, opacity: p.gridOriginalOpacity },
        ORDER.gridOriginal,
      );
      const transformed = this.segments(
        lattice,
        { color: p.gridTransformed, width: 1.25, opacity: p.gridTransformedOpacity },
        ORDER.gridTransformed,
      );
      const R = GRID_2D_RANGE;
      const axes = this.geometry(
        staticSegments(new Float32Array([-R, 0, 0, R, 0, 0, 0, -R, 0, 0, R, 0])),
      );
      const axisImages = this.segments(
        axes,
        { color: p.gridTransformed, width: 2.25, opacity: 1 },
        ORDER.gridAxisImages,
      );
      this.mapped = [transformed, axisImages];
    } else {
      const ground = this.geometry(staticSegments(latticeSegments(GROUND_RANGE, true)));
      this.segments(ground, { color: p.groundGrid, width: 1, opacity: 1 }, ORDER.groundGrid);
      const cubeGeom = this.geometry(staticSegments(CUBE_EDGES));
      this.segments(
        cubeGeom,
        { color: p.gridOriginal, width: 1.25, opacity: 0.9 },
        ORDER.gridOriginal,
      );
      this.cube = this.segments(
        cubeGeom,
        { color: p.gridTransformed, width: 2, opacity: 1 },
        ORDER.gridTransformed,
      );
      const lat = this.geometry(staticSegments(latticeSegments(LATTICE_3D_RANGE)));
      this.lattice = this.segments(
        lat,
        { color: p.gridTransformed, width: 1, opacity: 0.5 },
        ORDER.gridTransformed,
      );
      this.mapped = [this.cube, this.lattice];
    }
    for (const m of this.mapped) makeMapped(m);
  }

  update(frame: FrameState): void {
    if (this.cube && this.lattice) {
      // A 3×2 map has a 2D domain: show the image of its lattice, not of a cube.
      const planarDomain = frame.shape.cols === 2;
      this.cube.visible = !planarDomain;
      this.lattice.visible = planarDomain;
    }
    if (!frame.matrixChanged) return;
    for (const m of this.mapped) applyMap(m, frame);
  }
}
