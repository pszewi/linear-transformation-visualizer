/**
 * Matrix tweening for the engine. Owns the CURRENT matrix buffer; `step()` writes into it
 * without allocating. A new target mid-flight starts from the current interpolated matrix.
 *
 * Also plays simple timelines (sequences of targets with a hold after each), used by
 * the `playSteps` event.
 */
import { getInterpolator, type InterpolationMode } from '../core/linalg/interpolate';
import { copyInto, equals, type Matrix, matrix, sameShape } from '../core/linalg/matrix';

export const TWEEN_MS = 600;

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

interface Segment {
  readonly target: Matrix;
  readonly duration: number;
  readonly hold: number;
}

export interface AnimatorOptions {
  /** Whether the user prefers reduced motion (checked at each animation start). */
  readonly reducedMotion?: () => boolean;
}

export class Animator {
  private cur: Matrix;
  private from: Matrix;
  private to: Matrix;
  private path: ((t: number, out: Matrix) => Matrix) | null = null;
  private start = 0;
  private duration = TWEEN_MS;
  private hold = 0;
  /** The current segment has reached its target (holding or about to finish). */
  private atEnd = false;
  /** Remaining timeline segments after the current one. */
  private queue: Segment[] = [];
  private queueIndex = 0;
  private mode: InterpolationMode = 'linear';
  private readonly reducedMotion: () => boolean;

  constructor(initial: Matrix, options: AnimatorOptions = {}) {
    this.cur = matrix(initial.rows, initial.cols, initial.data);
    this.from = matrix(initial.rows, initial.cols);
    this.to = matrix(initial.rows, initial.cols);
    this.reducedMotion = options.reducedMotion ?? (() => false);
  }

  /** The current (possibly interpolated) matrix. Reused buffer: do not retain or mutate. */
  get current(): Matrix {
    return this.cur;
  }

  get active(): boolean {
    return this.path !== null;
  }

  /** Jump to `m` and cancel any tween or timeline. Reallocates only on a shape change. */
  snap(m: Matrix): void {
    this.cancel();
    if (!sameShape(this.cur, m)) {
      this.cur = matrix(m.rows, m.cols);
      this.from = matrix(m.rows, m.cols);
      this.to = matrix(m.rows, m.cols);
    }
    copyInto(this.cur, m);
  }

  cancel(): void {
    this.path = null;
    this.queue = [];
    this.queueIndex = 0;
  }

  /**
   * Tween from the current matrix to `target`. Returns false (and snaps) when the motion is
   * skipped: reduced motion, shape change, or already there.
   */
  animateTo(target: Matrix, mode: InterpolationMode, now: number, duration = TWEEN_MS): boolean {
    if (!sameShape(this.cur, target) || this.reducedMotion()) {
      this.snap(target);
      return false;
    }
    // Re-dispatching the target already being approached keeps the tween going.
    if (this.path !== null && this.queue.length === 0 && equals(this.to, target)) return true;
    this.cancel();
    if (equals(this.cur, target)) return false;
    this.mode = mode;
    this.begin(target, now, duration, 0);
    return true;
  }

  /**
   * Play a timeline through `targets`, each tweened over `segmentMs` then held for `holdMs`.
   * Targets are copied, so callers may reuse their matrices.
   */
  play(
    targets: readonly Matrix[],
    mode: InterpolationMode,
    now: number,
    segmentMs: number,
    holdMs: number,
  ): void {
    const valid = targets.filter((t) => sameShape(t, this.cur));
    if (valid.length === 0) return;
    if (this.reducedMotion()) {
      this.snap(valid[valid.length - 1]);
      return;
    }
    this.cancel();
    this.mode = mode;
    this.queue = valid.map((t) => ({
      target: matrix(t.rows, t.cols, t.data),
      duration: segmentMs,
      hold: holdMs,
    }));
    this.queueIndex = 0;
    this.nextSegment(now);
  }

  /**
   * Advance to time `now`. Returns true iff the current matrix changed (it may stay `active`
   * while holding). Never allocates within a segment.
   */
  step(now: number): boolean {
    if (this.path === null) return false;
    const elapsed = Math.max(0, now - this.start);
    const t = this.duration > 0 ? Math.min(1, elapsed / this.duration) : 1;
    if (t < 1) {
      this.path(easeInOutCubic(t), this.cur);
      this.atEnd = false;
      return true;
    }
    let changed = false;
    if (!this.atEnd) {
      copyInto(this.cur, this.to);
      this.atEnd = true;
      changed = true;
    }
    if (elapsed < this.duration + this.hold) return changed;
    if (this.queueIndex < this.queue.length) this.nextSegment(now);
    else this.cancel();
    return changed;
  }

  private nextSegment(now: number): void {
    const seg = this.queue[this.queueIndex++];
    this.begin(seg.target, now, seg.duration, seg.hold);
  }

  private begin(target: Matrix, now: number, duration: number, hold: number): void {
    copyInto(this.from, this.cur);
    copyInto(this.to, target);
    this.path = getInterpolator(this.mode).prepare(this.from, this.to);
    this.start = now;
    this.duration = duration;
    this.hold = hold;
    this.atEnd = false;
  }
}
