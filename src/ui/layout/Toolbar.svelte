<script lang="ts">
  import type { SceneStore } from '../../state/store.types';
  import Button from '../components/Button.svelte';
  import IconButton from '../components/IconButton.svelte';
  import SegmentedControl from '../components/SegmentedControl.svelte';
  import type { SegmentOption } from '../components/types';
  import { MOD_KEY } from '../lib/dom';
  import AppMark from './AppMark.svelte';

  interface Props {
    store: SceneStore;
    narrow: boolean;
    onshare: () => void;
    onhelp: () => void;
  }

  let { store, narrow, onshare, onhelp }: Props = $props();

  type DimValue = '2' | '3';
  const dims: SegmentOption<DimValue>[] = [
    { value: '2', label: '2D', ariaLabel: '2D (2 by 2 matrix)' },
    { value: '3', label: '3D', ariaLabel: '3D (3 by 3 matrix)' },
  ];
</script>

<header class="toolbar glass" class:narrow>
  <div class="brand">
    <AppMark />
    <h1 class="title">Linear Transformation <span>Visualizer</span></h1>
  </div>

  <span class="divider" aria-hidden="true"></span>

  <SegmentedControl
    options={dims}
    value={String(store.dim) as DimValue}
    onchange={(v) => store.setDimension(v === '2' ? 2 : 3)}
    label="Dimension"
    size="sm"
  />

  <span class="divider" aria-hidden="true"></span>

  <div class="group">
    <IconButton
      icon="undo"
      label="Undo"
      shortcut={[MOD_KEY, 'Z']}
      disabled={!store.canUndo}
      onclick={() => store.undo()}
    />
    <IconButton
      icon="redo"
      label="Redo"
      shortcut={['⇧', MOD_KEY, 'Z']}
      disabled={!store.canRedo}
      onclick={() => store.redo()}
    />
    <IconButton
      icon="focus"
      label="Reset camera"
      shortcut={['R']}
      onclick={() => store.resetCamera()}
    />
    {#if !narrow}
      <IconButton icon="keyboard" label="Keyboard shortcuts" shortcut={['?']} onclick={onhelp} />
    {/if}
  </div>

  {#if narrow}
    <IconButton icon="link" label="Copy share link" onclick={onshare} />
  {:else}
    <Button variant="primary" size="sm" icon="link" onclick={onshare}>Share</Button>
  {/if}
</header>

<style>
  .toolbar {
    position: fixed;
    z-index: var(--z-panels);
    top: var(--inset);
    left: var(--inset);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    height: var(--toolbar-height);
    padding: 0 var(--space-2) 0 var(--space-2);
    border-radius: var(--radius-pill);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding-right: var(--space-1);
  }

  .title {
    color: var(--color-text);
    font-size: var(--text-md);
    font-weight: var(--weight-semibold);
    letter-spacing: -0.01em;
    white-space: nowrap;
  }

  .title span {
    color: var(--color-text-muted);
    font-weight: var(--weight-regular);
  }

  .divider {
    width: 1px;
    height: 20px;
    background: var(--color-border);
  }

  .group {
    display: flex;
    align-items: center;
    gap: var(--space-0);
  }

  .toolbar :global(.btn[data-variant='primary']) {
    border-radius: var(--radius-pill);
    padding: 0 var(--space-3);
  }

  /* Narrow: full width, brand reduced to the mark. */
  .narrow {
    right: var(--inset);
    justify-content: space-between;
    gap: var(--space-1);
    padding: 0 var(--space-1) 0 var(--space-2);
  }

  /* Below 1100px the sidebar leaves no room for the name: keep it for screen readers only. */
  @media (max-width: 1100px) {
    .title {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }
  }
</style>
