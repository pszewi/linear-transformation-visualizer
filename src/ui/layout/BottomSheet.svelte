<!--
  Narrow-viewport container for the panels: a bottom sheet with three snap heights
  (peek / half / full). Drag the handle, tap it to toggle, or use ↑/↓ on it.
-->
<script lang="ts">
  import type { SceneStore } from '../../state/store.types';
  import PanelStack from './PanelStack.svelte';
  import ScrollArea from './ScrollArea.svelte';

  interface Props {
    store: SceneStore;
  }

  let { store }: Props = $props();

  type Snap = 'peek' | 'half' | 'full';
  const ORDER: readonly Snap[] = ['peek', 'half', 'full'];
  const PEEK = 112;

  let viewportH = $state(typeof innerHeight === 'number' ? innerHeight : 800);
  let snap = $state<Snap>('half');
  let dragH = $state<number | null>(null);

  function heightOf(s: Snap): number {
    const max = viewportH - 72; // keep the toolbar visible
    if (s === 'peek') return PEEK;
    if (s === 'half') return Math.round(Math.min(max, Math.max(PEEK + 80, viewportH * 0.5)));
    return max;
  }

  const height = $derived(dragH ?? heightOf(snap));

  let start: { y: number; h: number; id: number; moved: boolean } | null = null;

  function onpointerdown(e: PointerEvent) {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    start = { y: e.clientY, h: height, id: e.pointerId, moved: false };
  }

  function onpointermove(e: PointerEvent) {
    if (!start || e.pointerId !== start.id) return;
    const dy = e.clientY - start.y;
    if (!start.moved && Math.abs(dy) < 4) return;
    start.moved = true;
    dragH = Math.min(heightOf('full'), Math.max(PEEK - 24, start.h - dy));
  }

  function onpointerup(e: PointerEvent) {
    if (!start || e.pointerId !== start.id) return;
    const { moved } = start;
    start = null;
    if (!moved) {
      snap = snap === 'peek' ? 'half' : 'peek';
      return;
    }
    const h = dragH ?? height;
    dragH = null;
    snap = ORDER.reduce((best, s) =>
      Math.abs(heightOf(s) - h) < Math.abs(heightOf(best) - h) ? s : best,
    );
  }

  function onkeydown(e: KeyboardEvent) {
    const k = ORDER.indexOf(snap);
    if (e.key === 'ArrowUp' && k < ORDER.length - 1) snap = ORDER[k + 1];
    else if (e.key === 'ArrowDown' && k > 0) snap = ORDER[k - 1];
    else if (e.key === 'Enter' || e.key === ' ') snap = snap === 'peek' ? 'half' : 'peek';
    else return;
    e.preventDefault();
  }
</script>

<svelte:window bind:innerHeight={viewportH} />

<section
  class="sheet glass"
  data-occludes="bottom"
  class:dragging={dragH !== null}
  style:height="{height}px"
  aria-label="Inspector"
>
  <button
    type="button"
    class="handle"
    aria-label="Resize panel sheet"
    aria-expanded={snap !== 'peek'}
    {onpointerdown}
    {onpointermove}
    {onpointerup}
    onpointercancel={onpointerup}
    {onkeydown}
  >
    <span class="grabber" aria-hidden="true"></span>
  </button>
  <ScrollArea label="Panels">
    <div class="content"><PanelStack {store} /></div>
  </ScrollArea>
</section>

<style>
  .sheet {
    position: fixed;
    z-index: var(--z-panels);
    right: 0;
    bottom: 0;
    left: 0;
    display: flex;
    flex-direction: column;
    border-bottom: none;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    transition: height var(--duration-slow) var(--ease-out);
  }

  .sheet.dragging {
    transition: none;
  }

  .handle {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    height: 28px;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    cursor: grab;
    touch-action: none;
  }

  .dragging .handle {
    cursor: grabbing;
  }

  .grabber {
    width: 36px;
    height: 4px;
    border-radius: var(--radius-pill);
    background: var(--color-border-strong);
    transition: background-color var(--duration-fast) var(--ease-out);
  }

  .handle:hover .grabber {
    background: var(--color-text-faint);
  }

  .handle:focus-visible {
    outline-offset: -4px;
  }

  .content {
    padding: 0 var(--space-2) calc(var(--space-2) + env(safe-area-inset-bottom));
  }

  .sheet :global(.scroll) {
    flex: 1;
  }
</style>
