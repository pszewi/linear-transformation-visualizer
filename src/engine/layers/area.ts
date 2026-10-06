/**
 * Signed area / volume: the image of the unit square (2D fill) or unit cube (3D translucent
 * faces), coloured by sign(det) and faded out as the map degenerates. Built once; GPU-mapped.
 * For a 3×2 map the unit square's image (a parallelogram in R³) is shown instead of the cube.
 */
import {
  BoxGeometry,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  type Mesh,
  MeshBasicMaterial,
} from 'three';
import type { FrameState, LayerContext } from '../types';
import { ORDER } from '../renderOrder';
import { HookedMesh, type Segments, staticSegments } from '../primitives/lines';
import { applyMap, BaseLayer, makeMapped } from './BaseLayer';

/** |det| (area/volume scale factor) below which the fill fades towards invisible. */
const FADE_BELOW = 0.08;

function unitSquare(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

export class AreaLayer extends BaseLayer {
  readonly id = 'area';
  private fillMaterial: MeshBasicMaterial | null = null;
  private square: Mesh | null = null;
  private cube: Mesh | null = null;
  private outline: Segments | null = null;

  protected build(ctx: LayerContext): void {
    const p = ctx.palette;
    const depth = ctx.dim === 3;
    const mat = this.own(
      new MeshBasicMaterial({
        color: p.areaPositive,
        transparent: true,
        opacity: 0, // set per update: depends on which geometry (square / cube) is shown
        depthTest: depth,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    this.fillMaterial = mat;
    this.square = new HookedMesh(this.geometry(unitSquare()), mat);
    this.square.renderOrder = depth ? ORDER.surface : ORDER.areaFill;
    makeMapped(this.square);
    ctx.root.add(this.square);
    if (ctx.dim === 3) {
      const box = this.geometry(new BoxGeometry(1, 1, 1));
      box.translate(0.5, 0.5, 0.5);
      this.cube = new HookedMesh(box, mat);
      this.cube.renderOrder = ORDER.surface;
      makeMapped(this.cube);
      ctx.root.add(this.cube);
    } else {
      const edges = this.geometry(
        staticSegments(new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0])),
      );
      this.outline = this.segments(
        edges,
        { color: p.areaPositive, width: 2, opacity: 0.9 },
        ORDER.areaOutline,
      );
      makeMapped(this.outline);
    }
  }

  update(frame: FrameState): void {
    if (!frame.matrixChanged) return;
    const p = this.ctx.palette;
    const a = frame.analysis;
    const planarDomain = frame.shape.cols === 2;
    let strength: number;
    let negative = false;
    if (a.square && a.det !== undefined) {
      strength = Math.min(1, Math.abs(a.det) / FADE_BELOW);
      negative = a.det < 0;
    } else {
      // Non-square: an image of full dimension in the ambient space is drawable; else degenerate.
      strength = a.rank === frame.shape.cols && planarDomain ? 1 : 0;
    }
    if (!Number.isFinite(strength)) strength = 0;
    const color = negative ? p.areaNegative : p.areaPositive;

    const mat = this.fillMaterial;
    if (mat) {
      mat.color.setHex(color);
      // A lone parallelogram (2D, or a 3×2 map) vs. a parallelepiped whose faces overlap.
      mat.opacity = (planarDomain ? p.areaOpacity : p.areaOpacity3d) * strength;
    }
    if (this.square) {
      this.square.visible = planarDomain && strength > 0;
      applyMap(this.square, frame);
    }
    if (this.cube) {
      this.cube.visible = !planarDomain && strength > 0;
      applyMap(this.cube, frame);
    }
    if (this.outline) {
      this.outline.visible = strength > 0;
      this.outline.material.color.setHex(color);
      this.outline.material.opacity = 0.9 * strength;
      applyMap(this.outline, frame);
    }
  }
}
