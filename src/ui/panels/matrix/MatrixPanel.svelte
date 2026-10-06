<script lang="ts">
  import { slide } from 'svelte/transition';
  import type { SceneStore } from '../../../state/store.types';
  import Icon from '../../components/Icon.svelte';
  import { ALT_KEY, prefersReducedMotion, uid } from '../../lib/dom';
  import { prefs, savePrefs } from '../../lib/prefs.svelte';
  import EntrySliders from './EntrySliders.svelte';
  import MatrixEditor from './MatrixEditor.svelte';

  interface Props {
    store: SceneStore;
  }

  let { store }: Props = $props();

  const slidersId = uid('sliders');
  const duration = prefersReducedMotion() ? 0 : 200;

  function toggleSliders() {
    prefs.entrySlidersOpen = !prefs.entrySlidersOpen;
    savePrefs();
  }
</script>

<MatrixEditor {store} />

<p class="hint">
  Drag to scrub · click to type · <kbd>⇧</kbd> fine · <kbd>{ALT_KEY}</kbd> coarse
</p>

<div class="disclosure">
  <button
    type="button"
    class="disclosure-toggle"
    class:open={prefs.entrySlidersOpen}
    aria-expanded={prefs.entrySlidersOpen}
    aria-controls={slidersId}
    onclick={toggleSliders}
  >
    <span class="chevron"><Icon name="chevronRight" size={13} /></span>
    Entry sliders
  </button>
  {#if prefs.entrySlidersOpen}
    <div id={slidersId} class="disclosure-body" transition:slide={{ duration }}>
      <EntrySliders {store} />
    </div>
  {/if}
</div>

<style>
  .hint {
    margin-top: var(--space-3);
    color: var(--color-text-faint);
    font-size: var(--text-xs);
    text-align: center;
  }

  .hint kbd {
    font-family: var(--font-sans);
    color: var(--color-text-muted);
  }

  .disclosure {
    margin-top: var(--space-3);
    border-top: 1px solid var(--color-border-subtle);
    padding-top: var(--space-2);
  }

  .disclosure-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    height: var(--control-height-sm);
    margin-left: calc(-1 * var(--space-2));
    padding: 0 var(--space-2);
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    transition:
      background-color var(--duration-fast) var(--ease-out),
      color var(--duration-fast) var(--ease-out);
  }

  .disclosure-toggle:hover {
    background: var(--color-overlay-hover);
    color: var(--color-text);
  }

  .chevron {
    display: grid;
    place-items: center;
    transition: transform var(--duration-base) var(--ease-out);
  }

  .open .chevron {
    transform: rotate(90deg);
  }

  .disclosure-body {
    padding-top: var(--space-2);
  }
</style>
