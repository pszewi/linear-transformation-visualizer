<script lang="ts">
  import { presetsFor } from '../../state/presets';
  import { ACTIVE_TRANSFORM } from '../../state/store.svelte';
  import type { SceneStore } from '../../state/store.types';
  import Tooltip from '../components/Tooltip.svelte';
  import MiniMatrix from './MiniMatrix.svelte';

  interface Props {
    store: SceneStore;
  }

  let { store }: Props = $props();

  const presets = $derived(presetsFor(store.shape));
  const activeId = $derived.by(() => {
    if (store.doc.transforms.length !== 1) return null;
    const rows = store.doc.transforms[ACTIVE_TRANSFORM].rows;
    const match = presets.find((p) => p.rows.every((r, i) => r.every((x, j) => x === rows[i][j])));
    return match?.id ?? null;
  });
</script>

{#if presets.length === 0}
  <p class="empty">No presets for this shape.</p>
{:else}
  <div class="grid">
    {#each presets as preset (preset.id)}
      <Tooltip text={preset.description} placement="left" wide delay={500}>
        {#snippet children({ describedBy })}
          <button
            type="button"
            class="card"
            aria-pressed={activeId === preset.id}
            aria-describedby={describedBy}
            onclick={() => store.applyPreset(preset.id)}
          >
            <MiniMatrix rows={preset.rows} />
            <span class="name">{preset.name}</span>
          </button>
        {/snippet}
      </Tooltip>
    {/each}
  </div>
{/if}

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .grid > :global(*) {
    display: flex;
    min-width: 0;
  }

  .card {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    min-width: 0;
    min-height: 52px;
    padding: var(--space-2);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    background: var(--color-surface-2);
    text-align: left;
    transition:
      background-color var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out),
      transform var(--duration-fast) var(--ease-out);
  }

  .card:hover {
    border-color: var(--color-border-strong);
    background: var(--color-surface-3);
  }

  .card:active {
    transform: scale(0.98);
  }

  .card[aria-pressed='true'] {
    border-color: var(--color-accent);
    background: var(--color-accent-softer);
  }

  .card[aria-pressed='true'] .name {
    color: var(--color-accent-hover);
  }

  .name {
    min-width: 0;
    color: var(--color-text);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    line-height: var(--leading-tight);
  }

  .empty {
    color: var(--color-text-faint);
    font-size: var(--text-sm);
  }
</style>
