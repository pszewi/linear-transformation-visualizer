<script lang="ts">
  import { LAYERS, layerVisible } from '../../state/layers';
  import type { SceneStore } from '../../state/store.types';
  import Toggle from '../components/Toggle.svelte';
  import { uid } from '../lib/dom';

  interface Props {
    store: SceneStore;
  }

  let { store }: Props = $props();

  const prefix = uid('layer');
  const layers = $derived(LAYERS.filter((l) => l.dims.includes(store.dim)));
</script>

<ul class="layers">
  {#each layers as layer (layer.id)}
    <li>
      <label class="row">
        <span class="text">
          <span class="label">{layer.label}</span>
          <span class="desc" id="{prefix}-{layer.id}">{layer.description}</span>
        </span>
        <Toggle
          checked={layerVisible(store.doc.view.layers, layer.id)}
          label={layer.label}
          describedBy="{prefix}-{layer.id}"
          size="sm"
          onchange={(on) => store.setLayerVisible(layer.id, on)}
        />
      </label>
    </li>
  {/each}
</ul>

<style>
  .layers {
    display: flex;
    flex-direction: column;
    list-style: none;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin: 0 calc(-1 * var(--space-2));
    padding: var(--space-2);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background-color var(--duration-fast) var(--ease-out);
  }

  .row:hover {
    background: var(--color-overlay-hover);
  }

  .text {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  .label {
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  .desc {
    color: var(--color-text-faint);
    font-size: var(--text-xs);
    line-height: var(--leading-tight);
  }
</style>
