import { describe, expect, it } from 'vitest';
import { fromRows, identity, type Matrix } from '../../../src/core/linalg/matrix';
import { Animator, easeInOutCubic, TWEEN_MS } from '../../../src/engine/Animator';

const rows = (m: Matrix): number[] => Array.from(m.data);
const scale = (s: number): Matrix =>
  fromRows([
    [s, 0],
    [0, s],
  ]);

describe('easeInOutCubic', () => {
  it('is monotone from 0 to 1 and symmetric', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 12);
    expect(easeInOutCubic(0.25) + easeInOutCubic(0.75)).toBeCloseTo(1, 12);
  });
});

describe('Animator', () => {
  it('tweens to the target over TWEEN_MS and then stops', () => {
    const a = new Animator(identity(2));
    expect(a.animateTo(scale(3), 'linear', 0)).toBe(true);
    expect(a.step(TWEEN_MS / 2)).toBe(true);
    expect(a.current.data[0]).toBeCloseTo(2, 12); // eased midpoint of 1 → 3
    a.step(TWEEN_MS);
    expect(rows(a.current)).toEqual(rows(scale(3)));
    expect(a.active).toBe(false);
  });

  it('a new target mid-flight starts from the current interpolated matrix', () => {
    const a = new Animator(identity(2));
    a.animateTo(scale(3), 'linear', 0);
    a.step(TWEEN_MS / 2);
    const mid = a.current.data[0];
    a.animateTo(scale(0), 'linear', TWEEN_MS / 2);
    a.step(TWEEN_MS / 2); // t = 0 of the new tween: no jump
    expect(a.current.data[0]).toBeCloseTo(mid, 12);
  });

  it('a live snap cancels the tween', () => {
    const a = new Animator(identity(2));
    a.animateTo(scale(3), 'linear', 0);
    a.snap(scale(-1));
    expect(a.active).toBe(false);
    expect(rows(a.current)).toEqual(rows(scale(-1)));
  });

  it('reduced motion snaps', () => {
    const a = new Animator(identity(2), { reducedMotion: () => true });
    expect(a.animateTo(scale(2), 'linear', 0)).toBe(false);
    expect(rows(a.current)).toEqual(rows(scale(2)));
  });

  it('reallocates on a shape change instead of throwing', () => {
    const a = new Animator(identity(2));
    a.animateTo(identity(3), 'linear', 0);
    expect(a.current.rows).toBe(3);
  });

  it('plays a timeline through every target with holds', () => {
    const a = new Animator(identity(2));
    a.play([scale(2), scale(4)], 'linear', 0, 100, 50);
    a.step(100);
    expect(a.current.data[0]).toBe(2);
    expect(a.step(120)).toBe(false); // holding: no change
    a.step(150); // next segment starts
    a.step(250);
    expect(a.current.data[0]).toBe(4);
    a.step(300);
    expect(a.active).toBe(false);
  });

  it('does not allocate a new current buffer per step', () => {
    const a = new Animator(identity(2));
    const buf = a.current;
    a.animateTo(scale(2), 'linear', 0);
    for (let t = 0; t <= TWEEN_MS; t += 16) a.step(t);
    expect(a.current).toBe(buf);
  });
});
