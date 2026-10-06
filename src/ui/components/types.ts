/** Shared prop types for components. */

export interface SegmentOption<V extends string> {
  value: V;
  label: string;
  /** Accessible name if the visible label is terse (e.g. "2D"). */
  ariaLabel?: string;
}
