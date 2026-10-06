/**
 * User vectors: an arrow for v, an arrow for A·v, a faint dashed connector v → A·v, and labels.
 * Slots are pooled (grown on demand, never recreated); extra slots are hidden.
 */
import { type Camera, Vector3, type WebGLRenderer } from 'three';
import type { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import type { SceneObject } from '../../state/document';
import type { ObjectColorKey, ScenePalette } from '../../theme/palette';
import type { FrameState, LayerContext } from '../types';
import { type Arrow, ArrowKit } from '../primitives/Arrow';
import { cssHex, type Label } from '../primitives/Label';
import { type Segments, unitSegment } from '../primitives/lines';
import { worldPerPixel } from '../primitives/screen';
import { applyPadded, padTo3 } from '../embed';
import { ORDER } from '../renderOrder';
import { BaseLayer } from './BaseLayer';

const SUB_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'] as const;
const LABEL_COLLISION = 0.3;

const _mid = new Vector3();
const _a = new Vector3();
const _b = new Vector3();

interface Slot {
  readonly before: Arrow;
  readonly after: Arrow;
  readonly connector: Segments;
  readonly beforeLabel: Label;
  readonly afterLabel: Label;
  readonly v: Float64Array;
  readonly av: Float64Array;
  colorKey: string;
  name: string;
  length: number;
}

export function objectColors(p: ScenePalette, key: string | undefined): readonly [number, number] {
  const k = (key !== undefined && key in p.objects ? key : p.defaultObjectColor) as ObjectColorKey;
  return p.objects[k];
}

function subscript(n: number): string {
  let s = '';
  for (const ch of String(n)) s += SUB_DIGITS[Number(ch)];
  return s;
}

export class ObjectsLayer extends BaseLayer {
  readonly id = 'objects';
  private kit: ArrowKit | null = null;
  private connectorGeometry: LineSegmentsGeometry | null = null;
  private readonly slots: Slot[] = [];

  protected build(ctx: LayerContext): void {
    this.kit = this.own(new ArrowKit(ctx.dim));
    this.connectorGeometry = this.geometry(unitSegment());
  }

  private addSlot(): Slot {
    if (!this.kit || !this.connectorGeometry) throw new Error('objects: not built');
    const [c0, c1] = objectColors(this.ctx.palette, undefined);
    const before = this.kit.create({
      color: c0,
      width: 2.5,
      renderOrder: ORDER.objectBefore,
      casing: this.ctx.palette.background,
    });
    const after = this.kit.create({
      color: c1,
      width: 2.75,
      headLength: 13,
      headWidth: 10,
      renderOrder: ORDER.objectAfter,
      casing: this.ctx.palette.background,
    });
    const connector = this.segments(
      this.connectorGeometry,
      { color: c0, width: 1.25, opacity: 0.5, dash: { dash: 4, gap: 4 } },
      ORDER.connector,
    );
    connector.matrixAutoUpdate = false;
    const beforeLabel = this.label('', 'ltv-object');
    const afterLabel = this.label('', 'ltv-object');
    before.attachLabel(beforeLabel);
    after.attachLabel(afterLabel);
    this.ctx.root.add(before.object, after.object);
    const slot: Slot = {
      before,
      after,
      connector,
      beforeLabel,
      afterLabel,
      v: new Float64Array(3),
      av: new Float64Array(3),
      colorKey: '',
      name: '',
      length: 0,
    };
    connector.hook = (renderer, camera) => this.layoutConnector(slot, renderer, camera);
    this.slots.push(slot);
    return slot;
  }

  update(frame: FrameState): void {
    if (!frame.matrixChanged && !frame.objectsChanged) return;
    let used = 0;
    const objects = frame.objects;
    for (let i = 0; i < objects.length; i++) {
      const o: SceneObject = objects[i];
      if (o.kind !== 'vector' || !o.visible) continue;
      const slot = used < this.slots.length ? this.slots[used] : this.addSlot();
      used++;
      // Names (strings) are rebuilt only when the objects change, not on every matrix frame.
      if (frame.objectsChanged || slot.name === '') {
        this.setName(slot, o.label ?? `v${subscript(i + 1)}`);
      }
      this.fill(slot, o.coords, o.colorKey, frame);
    }
    for (let i = used; i < this.slots.length; i++) {
      const s = this.slots[i];
      s.before.hide();
      s.after.hide();
      s.connector.visible = false;
    }
  }

  private setName(slot: Slot, name: string): void {
    if (name === slot.name) return;
    slot.name = name;
    slot.beforeLabel.setText(name);
    slot.afterLabel.setText(`A${name}`);
  }

  private fill(
    slot: Slot,
    coords: readonly number[],
    colorKey: string | undefined,
    frame: FrameState,
  ): void {
    const key = colorKey ?? '';
    if (key !== slot.colorKey) {
      slot.colorKey = key;
      const [c0, c1] = objectColors(this.ctx.palette, colorKey);
      slot.before.setColor(c0);
      slot.after.setColor(c1);
      slot.connector.material.color.setHex(c0);
      slot.beforeLabel.setColor(cssHex(c0));
      slot.afterLabel.setColor(cssHex(c1));
    }

    const v = padTo3(coords, frame.shape.cols, slot.v);
    const av = applyPadded(frame.matrix, coords, slot.av);
    slot.before.set(0, 0, 0, v[0], v[1], v[2]);
    slot.after.set(0, 0, 0, av[0], av[1], av[2]);

    const dx = av[0] - v[0];
    const dy = av[1] - v[1];
    const dz = av[2] - v[2];
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    slot.length = len;
    slot.beforeLabel.visible = len > LABEL_COLLISION;
    const c = slot.connector;
    c.visible = len > LABEL_COLLISION;
    if (!c.visible) return;
    // Unit segment (0→1 along x) mapped onto v → Av.
    _a.set(dx, dy, dz).divideScalar(len);
    if (Math.abs(_a.z) < 0.9) _b.set(-_a.y, _a.x, 0);
    else _b.set(0, -_a.z, _a.y);
    _b.normalize();
    _mid.crossVectors(_a, _b);
    // prettier-ignore
    c.matrix.set(
      dx, _b.x, _mid.x, v[0],
      dy, _b.y, _mid.y, v[1],
      dz, _b.z, _mid.z, v[2],
      0, 0, 0, 1,
    );
    c.matrixWorldNeedsUpdate = true;
  }

  /** Pixel-constant dashes on the connector. */
  private layoutConnector(slot: Slot, renderer: WebGLRenderer, camera: Camera): void {
    _mid.set(
      (slot.v[0] + slot.av[0]) / 2,
      (slot.v[1] + slot.av[1]) / 2,
      (slot.v[2] + slot.av[2]) / 2,
    );
    slot.connector.material.dashScale = slot.length / worldPerPixel(camera, renderer, _mid);
  }
}
