<script lang="ts">
  import { MAX_OBJECTS } from '../../../state/limits';
  import type { SceneStore } from '../../../state/store.types';
  import Button from '../../components/Button.svelte';
  import VectorRow from './VectorRow.svelte';

  interface Props {
    store: SceneStore;
  }

  let { store }: Props = $props();

  const vectors = $derived(store.doc.objects.filter((o) => o.kind === 'vector'));
  const full = $derived(store.doc.objects.length >= MAX_OBJECTS);
</script>

{#if vectors.length === 0}
  <p class="empty">Add a vector to see where <i>A</i> sends it.</p>
{:else}
  <ul class="list">
    {#each vectors as vector (vector.id)}
      <VectorRow {store} {vector} />
    {/each}
  </ul>
{/if}

<div class="footer">
  <Button icon="plus" size="sm" variant="subtle" disabled={full} onclick={() => store.addVector()}>
    Add vector
  </Button>
  {#if full}<span class="limit">Limit of {MAX_OBJECTS} reached</span>{/if}
</div>

<style>
  .list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .empty {
    color: var(--color-text-faint);
    font-size: var(--text-sm);
  }

  .footer {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-top: var(--space-3);
  }

  .limit {
    color: var(--color-text-faint);
    font-size: var(--text-xs);
  }
</style>
