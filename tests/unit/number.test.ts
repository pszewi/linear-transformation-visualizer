import { describe, expect, it } from 'vitest';
import { editableText, parseNumberInput, roundTo } from '../../src/ui/lib/number';

describe('parseNumberInput', () => {
  it.each([
    ['1', 1],
    [' -2.5 ', -2.5],
    ['−0.75', -0.75],
    ['.5', 0.5],
    ['3.', 3],
    ['+4', 4],
    ['1,25', 1.25],
    ['2e-3', 0.002],
    ['1/2', 0.5],
    ['−3 / 4', -0.75],
  ])('parses %j', (input, expected) => {
    expect(parseNumberInput(input)).toBeCloseTo(expected, 12);
  });

  it.each(['', 'abc', '1..2', '1/0', '1/2/3', 'Infinity', 'NaN', '1e999', '2*3', 'alert(1)'])(
    'rejects %j',
    (input) => {
      expect(parseNumberInput(input)).toBeNull();
    },
  );
});

describe('roundTo', () => {
  it('rounds without binary noise', () => {
    expect(roundTo(0.1 + 0.2, 0.01)).toBe(0.3);
    expect(roundTo(1.23456, 0.001)).toBe(1.235);
    expect(roundTo(-0.0001, 0.01)).toBe(0);
    expect(Object.is(roundTo(-0.0001, 0.01), -0)).toBe(false);
    expect(roundTo(17.3, 0.1)).toBe(17.3);
  });
});

describe('editableText', () => {
  it('uses plain ASCII and limited precision', () => {
    expect(editableText(Math.SQRT1_2)).toBe('0.707107');
    expect(editableText(-2)).toBe('-2');
  });
});
