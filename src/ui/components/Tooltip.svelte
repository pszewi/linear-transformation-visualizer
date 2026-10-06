<!--
  Hover/focus tooltip. The visible bubble is portalled to <body> (so sidebars with overflow or
  backdrop-filter never clip it) and positioned with fixed coordinates. A screen-reader copy
  stays inside the anchor; pass `describedBy` from the children snippet to a focusable element.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { portal, uid } from '../lib/dom';
  import Kbd from './Kbd.svelte';

  type Placement = 'top' | 'bottom' | 'left' | 'right';

  interface Props {
    text: string;
    placement?: Placement;
    shortcut?: readonly string[];
    delay?: number;
    /** Wider bubble for explanatory text. */
    wide?: boolean;
    children: Snippet<[{ describedBy: string }]>;
  }

  let { text, placement = 'top', shortcut, delay = 350, wide = false, children }: Props = $props();

  const id = uid('tip');
  const GAP = 8;
  const MARGIN = 8;

  let anchor: HTMLSpanElement;
  let bubble = $state<HTMLDivElement>();
  let open = $state(false);
  let x = $state(0);
  let y = $state(0);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function place() {
    const r = anchor.getBoundingClientRect();
    if (placement === 'top' || placement === 'bottom') {
      x = r.left + r.width / 2;
      y = placement === 'top' ? r.top - GAP : r.bottom + GAP;
    } else {
      x = placement === 'left' ? r.left - GAP : r.right + GAP;
      y = r.top + r.height / 2;
    }
  }

  function show() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      place();
      open = true;
    }, delay);
  }

  function hide() {
    clearTimeout(timer);
    open = false;
  }

  // Keep the bubble inside the viewport horizontally.
  $effect(() => {
    if (!open || !bubble) return;
    const b = bubble.getBoundingClientRect();
    const overflowRight = b.right - (innerWidth - MARGIN);
    const overflowLeft = MARGIN - b.left;
    if (overflowRight > 0) x -= overflowRight;
    else if (overflowLeft > 0) x += overflowLeft;
  });

  // While open: dismiss on Escape or on any scroll (capture catches inner scrollers too).
  $effect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide();
    addEventListener('keydown', onKey);
    addEventListener('scroll', hide, { capture: true, passive: true });
    return () => {
      removeEventListener('keydown', onKey);
      removeEventListener('scroll', hide, { capture: true });
    };
  });

  $effect(() => () => clearTimeout(timer));
</script>

<span
  class="anchor"
  bind:this={anchor}
  onpointerenter={show}
  onpointerleave={hide}
  onfocusin={show}
  onfocusout={hide}
  onpointerdown={hide}
  role="presentation"
>
  {@render children({ describedBy: id })}
  <span class="sr-only" {id}>{text}</span>
</span>

{#if open}
  <div
    class="bubble"
    class:wide
    data-placement={placement}
    style:left="{x}px"
    style:top="{y}px"
    bind:this={bubble}
    use:portal
    aria-hidden="true"
  >
    <span>{text}</span>
    {#if shortcut}<Kbd keys={shortcut} />{/if}
  </div>
{/if}

<style>
  .anchor {
    display: inline-flex;
    min-width: 0;
  }

  .bubble {
    position: fixed;
    z-index: var(--z-tooltip);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    max-width: 220px;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background: var(--color-surface-3);
    box-shadow: var(--shadow-md);
    color: var(--color-text);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    line-height: var(--leading-tight);
    pointer-events: none;
    white-space: nowrap;
    animation: tip-in var(--duration-fast) var(--ease-out);
  }

  .bubble.wide {
    max-width: 260px;
    padding: var(--space-2) var(--space-3);
    font-weight: var(--weight-regular);
    line-height: var(--leading-normal);
    white-space: normal;
  }

  [data-placement='top'] {
    transform: translate(-50%, -100%);
  }
  [data-placement='bottom'] {
    transform: translate(-50%, 0);
  }
  [data-placement='left'] {
    transform: translate(-100%, -50%);
  }
  [data-placement='right'] {
    transform: translate(0, -50%);
  }

  @keyframes tip-in {
    from {
      opacity: 0;
    }
  }
</style>
