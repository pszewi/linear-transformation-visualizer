<!--
  A number you can scrub, type or step.
  - Drag horizontally: scrub ('live' while dragging, 'end' on release). Shift = fine, Alt = coarse.
  - Click (no drag), Enter or start typing: edit as text. Enter/blur commits, Esc cancels.
  - Arrow keys: ±step; Shift+arrows / PageUp/PageDown: ±bigStep (each a 'commit').
-->
<script lang="ts">
  import { tick } from 'svelte';
  import { formatNumber } from '../../core/format';
  import type { EditPhase } from '../../state/store.types';
  import { editableText, parseNumberInput, roundTo } from '../lib/number';

  interface Props {
    value: number;
    onchange: (value: number, phase: EditPhase) => void;
    /** Accessible name, e.g. "Entry row 1, column 2". */
    label: string;
    step?: number;
    bigStep?: number;
    /** Value change per pixel of horizontal drag (before modifiers). */
    sensitivity?: number;
    /** Decimals shown when not editing. */
    digits?: number;
    min?: number;
    max?: number;
    size?: 'sm' | 'md' | 'lg';
    align?: 'start' | 'center' | 'end';
    /** Fired on pointer enter/leave, for row/column highlighting. */
    onhover?: (hovering: boolean) => void;
  }

  let {
    value,
    onchange,
    label,
    step = 0.1,
    bigStep = 1,
    sensitivity = 0.02,
    digits = 2,
    min = -1e6,
    max = 1e6,
    size = 'md',
    align = 'center',
    onhover,
  }: Props = $props();

  const DRAG_THRESHOLD = 3;

  let display = $state<HTMLSpanElement>();
  let input = $state<HTMLInputElement>();
  let editing = $state(false);
  let invalid = $state(false);
  let scrubbing = $state(false);
  let draft = $state('');

  /** Active pointer gesture (non-reactive: updated on every pointermove). */
  let drag: { id: number; lastX: number; startX: number; raw: number; emitted: number } | null =
    null;

  const shown = $derived(formatNumber(value, digits));
  /** Long values step the font down so they never clip in fixed-width cells. */
  const length = $derived(Math.min(8, Math.max(5, shown.length)));
  const clamp = (x: number) => Math.min(max, Math.max(min, x));

  function modifiers(e: { shiftKey: boolean; altKey: boolean }) {
    if (e.shiftKey) return { rate: sensitivity * 0.1, quantum: 0.001 };
    if (e.altKey) return { rate: sensitivity * 10, quantum: 0.1 };
    return { rate: sensitivity, quantum: 0.01 };
  }

  function onpointerdown(e: PointerEvent) {
    if (editing || e.button !== 0) return;
    e.preventDefault(); // no text selection; we focus explicitly
    const el = e.currentTarget as HTMLSpanElement;
    el.focus({ preventScroll: true });
    el.setPointerCapture(e.pointerId);
    drag = { id: e.pointerId, startX: e.clientX, lastX: e.clientX, raw: value, emitted: value };
  }

  function onpointermove(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!scrubbing) {
      if (Math.abs(e.clientX - drag.startX) < DRAG_THRESHOLD) return;
      scrubbing = true;
      drag.lastX = e.clientX;
      document.body.classList.add('is-scrubbing');
      return;
    }
    const { rate, quantum } = modifiers(e);
    drag.raw = clamp(drag.raw + (e.clientX - drag.lastX) * rate);
    drag.lastX = e.clientX;
    const next = roundTo(drag.raw, quantum);
    if (next !== drag.emitted) {
      drag.emitted = next;
      onchange(next, 'live');
    }
  }

  function finishPointer(e: PointerEvent, cancelled: boolean) {
    if (!drag || e.pointerId !== drag.id) return;
    const wasScrubbing = scrubbing;
    const final = drag.emitted;
    drag = null;
    scrubbing = false;
    document.body.classList.remove('is-scrubbing');
    const el = e.currentTarget as HTMLSpanElement;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    if (wasScrubbing) {
      onchange(final, 'end');
      // A mouse scrub is not a request for keyboard focus: keep the global digit shortcuts
      // (2/3 switch dimension) working afterwards. Keyboard users who Tab in keep type-to-edit.
      if (e.pointerType === 'mouse') el.blur();
    } else if (!cancelled) void startEdit();
  }

  async function startEdit(initial?: string) {
    draft = initial ?? editableText(value);
    invalid = false;
    editing = true;
    await tick();
    input?.focus();
    if (initial === undefined) input?.select();
  }

  function commitEdit(refocus: boolean) {
    if (!editing) return;
    const parsed = parseNumberInput(draft);
    if (parsed === null) {
      if (refocus) {
        invalid = true; // keep editing so the user can fix it
        return;
      }
      cancelEdit(false);
      return;
    }
    editing = false;
    const next = clamp(parsed);
    if (next !== value) onchange(next, 'commit');
    if (refocus) void tick().then(() => display?.focus());
  }

  function cancelEdit(refocus: boolean) {
    editing = false;
    invalid = false;
    if (refocus) void tick().then(() => display?.focus());
  }

  function ondisplaykeydown(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey) return;
    const small = e.shiftKey ? bigStep : step;
    const deltas: Record<string, number> = {
      ArrowUp: small,
      ArrowRight: small,
      ArrowDown: -small,
      ArrowLeft: -small,
      PageUp: bigStep,
      PageDown: -bigStep,
    };
    const delta = deltas[e.key];
    if (delta !== undefined) {
      e.preventDefault();
      onchange(clamp(roundTo(value + delta, 1e-6)), 'commit');
      return;
    }
    if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      void startEdit();
      return;
    }
    if (!e.altKey && /^[\d.,\-−+]$/.test(e.key)) {
      e.preventDefault();
      void startEdit(e.key);
    }
  }

  function oninputkeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancelEdit(true);
    }
  }
</script>

<span class="scrub" data-size={size} data-align={align} data-length={length}>
  {#if editing}
    <input
      bind:this={input}
      bind:value={draft}
      class="field num"
      type="text"
      inputmode="decimal"
      autocomplete="off"
      spellcheck="false"
      aria-label={label}
      aria-invalid={invalid}
      oninput={() => (invalid = false)}
      onkeydown={oninputkeydown}
      onblur={() => commitEdit(false)}
    />
  {:else}
    <span
      bind:this={display}
      class="field num value"
      class:scrubbing
      role="spinbutton"
      tabindex="0"
      aria-label={label}
      aria-valuenow={value}
      aria-valuetext={shown}
      aria-valuemin={min}
      aria-valuemax={max}
      {onpointerdown}
      {onpointermove}
      onpointerup={(e) => finishPointer(e, false)}
      onpointercancel={(e) => finishPointer(e, true)}
      onkeydown={ondisplaykeydown}
      onpointerenter={() => onhover?.(true)}
      onpointerleave={() => onhover?.(false)}>{shown}</span
    >
  {/if}
</span>

<style>
  .scrub {
    --h: var(--control-height);
    --fs: var(--text-sm);
    display: flex;
    width: 100%;
    min-width: 0;
  }

  [data-size='sm'] {
    --h: var(--control-height-sm);
    --fs: var(--text-xs);
  }

  [data-size='lg'] {
    --h: var(--control-height-lg);
    --fs: var(--text-xl);
  }

  [data-size='lg'] .field {
    padding: 0 var(--space-1);
  }

  [data-size='lg'][data-length='6'] {
    --fs: var(--text-md);
  }

  [data-size='lg'][data-length='7'] {
    --fs: var(--text-sm);
  }

  [data-size='lg'][data-length='8'] {
    --fs: var(--text-xs);
  }

  .field {
    display: flex;
    align-items: center;
    width: 100%;
    min-width: 0;
    height: var(--h);
    padding: 0 var(--space-2);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    font-size: var(--fs);
    font-weight: var(--weight-medium);
    line-height: 1;
    white-space: nowrap;
  }

  [data-align='center'] .field {
    justify-content: center;
    text-align: center;
  }
  [data-align='end'] .field {
    justify-content: flex-end;
    text-align: right;
  }

  .value {
    overflow: hidden;
    color: var(--color-text);
    cursor: ew-resize;
    user-select: none;
    touch-action: pan-y;
    transition:
      background-color var(--duration-fast) var(--ease-out),
      color var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out);
  }

  .value:hover {
    background: var(--color-overlay-hover);
  }

  .value.scrubbing {
    background: var(--color-accent-soft);
    color: var(--color-accent-hover);
  }

  .value:focus-visible {
    outline-offset: 0;
  }

  input.field {
    background: var(--color-surface-inset);
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-softer);
    color: var(--color-text);
    caret-color: var(--color-accent);
  }

  input.field[aria-invalid='true'] {
    border-color: var(--color-negative);
    box-shadow: 0 0 0 3px var(--color-negative-soft);
  }

  :global(body.is-scrubbing),
  :global(body.is-scrubbing *) {
    cursor: ew-resize !important;
    user-select: none !important;
  }
</style>
