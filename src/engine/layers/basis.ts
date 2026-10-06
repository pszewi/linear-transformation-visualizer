/**
 * Basis vectors: e_i before the map (faint) and A·e_i after it, with small tip labels.
 * Domain basis = e_1 … e_cols; images are the columns of A (zero-padded to 3D).
 */
import type { FrameState, LayerContext } from '../types';
import { type Arrow, ArrowKit } from '../primitives/Arrow';
import type { Label } from '../primitives/Label';
import { columnPadded } from '../embed';
import { ORDER } from '../renderOrder';
import { BaseLayer } from './BaseLayer';

export const SUBSCRIPTS = ['₁', '₂', '₃'] as const;
/** Hide the "before" label when A·e_i lands this close to e_i (labels would collide). */
const LABEL_COLLISION = 0.3;

export class BasisLayer extends BaseLayer {
  readonly id = 'basis';
  private before: Arrow[] = [];
  private after: Arrow[] = [];
  private beforeLabels: Label[] = [];
  private readonly col = new Float64Array(3);

  protected build(ctx: LayerContext): void {
    const p = ctx.palette;
    const kit = this.own(new ArrowKit(ctx.dim));
    for (let k = 0; k < ctx.dim; k++) {
      const b = kit.create({
        color: p.basisBefore[k],
        width: 2,
        headLength: 10,
        headWidth: 8,
        renderOrder: ORDER.basisBefore,
      });
      // Label colours come from the scene palette so text always matches its arrow.
      const bl = this.label(`e${SUBSCRIPTS[k]}`, 'ltv-basis ltv-basis-before');
      bl.setColor(p.basisLabels[k]);
      b.attachLabel(bl);
      const a = kit.create({
        color: p.basis[k],
        width: 2.75,
        headLength: 13,
        headWidth: 10,
        renderOrder: ORDER.basisAfter,
        casing: p.background,
      });
      const al = this.label(`Ae${SUBSCRIPTS[k]}`, 'ltv-basis');
      al.setColor(p.basisLabels[k]);
      a.attachLabel(al);
      ctx.root.add(b.object, a.object);
      this.before.push(b);
      this.after.push(a);
      this.beforeLabels.push(bl);
    }
  }

  update(frame: FrameState): void {
    if (!frame.matrixChanged) return;
    const cols = frame.shape.cols;
    const c = this.col;
    for (let k = 0; k < this.before.length; k++) {
      if (k >= cols) {
        this.before[k].hide();
        this.after[k].hide();
        continue;
      }
      const ex = k === 0 ? 1 : 0;
      const ey = k === 1 ? 1 : 0;
      const ez = k === 2 ? 1 : 0;
      this.before[k].set(0, 0, 0, ex, ey, ez);
      columnPadded(frame.matrix, k, c);
      this.after[k].set(0, 0, 0, c[0], c[1], c[2]);
      const dx = c[0] - ex;
      const dy = c[1] - ey;
      const dz = c[2] - ez;
      this.beforeLabels[k].visible = dx * dx + dy * dy + dz * dz > LABEL_COLLISION ** 2;
    }
  }
}
