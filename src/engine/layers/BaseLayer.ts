/**
 * Shared plumbing for layers: resource ownership (everything created through `own()` / `label()`
 * is freed by `dispose()`), visibility, and helpers for fat lines and GPU-transformed objects.
 */
import type { BufferGeometry, Object3D } from 'three';
import type { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import type { FrameState, Layer, LayerContext } from '../types';
import { Label } from '../primitives/Label';
import { createLineMaterial, type LineStyle, Segments } from '../primitives/lines';

interface Disposable {
  dispose(): void;
}

export abstract class BaseLayer implements Layer {
  abstract readonly id: string;
  private context: LayerContext | null = null;
  private readonly owned: Disposable[] = [];
  private readonly labels: Label[] = [];

  protected get ctx(): LayerContext {
    if (this.context === null) throw new Error(`Layer ${this.id} used before init`);
    return this.context;
  }

  init(ctx: LayerContext): void {
    this.context = ctx;
    this.build(ctx);
  }

  /** Create every GPU resource and DOM node here. */
  protected abstract build(ctx: LayerContext): void;

  abstract update(frame: FrameState): void;

  setVisible(visible: boolean): void {
    this.ctx.root.visible = visible;
  }

  dispose(): void {
    for (let i = this.owned.length - 1; i >= 0; i--) this.owned[i].dispose();
    this.owned.length = 0;
    for (const l of this.labels) l.dispose();
    this.labels.length = 0;
    this.context?.root.clear();
    this.context = null;
  }

  /** Register a resource to be disposed with the layer. */
  protected own<T extends Disposable>(resource: T): T {
    this.owned.push(resource);
    return resource;
  }

  /** Create a tracked label (not yet parented). */
  protected label(text: string, className: string): Label {
    const l = new Label(text, className);
    this.labels.push(l);
    return l;
  }

  /** Fat-line object on `geometry` (geometry ownership stays with the caller). */
  protected segments(
    geometry: LineSegmentsGeometry,
    style: LineStyle,
    renderOrder: number,
    parent: Object3D = this.ctx.root,
  ): Segments {
    const material = this.own(createLineMaterial({ depth: this.ctx.dim === 3, ...style }));
    const s = new Segments(geometry, material);
    s.renderOrder = renderOrder;
    parent.add(s);
    return s;
  }

  /** Owned geometry helper. */
  protected geometry<T extends BufferGeometry>(g: T): T {
    return this.own(g);
  }
}

/** Mark `obj` as "image of fixed geometry": the GPU applies frame.matrix4. */
export function makeMapped(obj: Object3D): void {
  obj.matrixAutoUpdate = false;
  obj.frustumCulled = false;
}

export function applyMap(obj: Object3D, frame: FrameState): void {
  obj.matrix.copy(frame.matrix4);
  obj.matrixWorldNeedsUpdate = true;
}
