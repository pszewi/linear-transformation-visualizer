<script lang="ts">
  import { apply } from '../../../core/linalg/ops';
  import type { VectorObject } from '../../../state/document';
  import { OBJECT_COLOR_KEYS } from '../../../state/objectColors';
  import type { SceneStore } from '../../../state/store.types';
  import { scenePalette } from '../../../theme/palette';
  import IconButton from '../../components/IconButton.svelte';
  import ScrubNumber from '../../components/ScrubNumber.svelte';
  import { formatTuple, range } from '../../lib/text';

  interface Props {
    store: SceneStore;
    vector: VectorObject;
  }

  let { store, vector }: Props = $props();

  const name = $derived(vector.label ?? 'v');
  const colorKey = $derived(vector.colorKey ?? scenePalette.defaultObjectColor);
  const axes = ['x', 'y', 'z'];
  const coordIdx = $derived(range(vector.coords.length));
  const image = $derived(formatTuple(apply(store.matrix, vector.coords)));

  function setCoord(k: number, value: number, phase: 'live' | 'end' | 'commit') {
    const coords = [...vector.coords];
    coords[k] = value;
    store.updateObject(vector.id, { coords }, phase);
  }
</script>

<li
  class="vector"
  class:hidden={!vector.visible}
  style:--obj="var(--color-object-{colorKey})"
  style:--img="var(--color-object-{colorKey}-image)"
>
  <div class="main">
    <span class="dot" aria-hidden="true"></span>
    <span class="name">{name}</span>
    <div class="coords" style:--n={coordIdx.length}>
      {#each coordIdx as k (k)}
        <ScrubNumber
          value={vector.coords[k]}
          onchange={(v, phase) => setCoord(k, v, phase)}
          label="{name} {axes[k] ?? `coordinate ${k + 1}`}"
          size="sm"
        />
      {/each}
    </div>
    <IconButton
      label={vector.visible ? `Hide ${name}` : `Show ${name}`}
      icon={vector.visible ? 'eye' : 'eyeOff'}
      size="sm"
      tooltip="top"
      onclick={() => store.updateObject(vector.id, { visible: !vector.visible }, 'commit')}
    />
    <IconButton
      label="Delete {name}"
      icon="trash"
      size="sm"
      tone="danger"
      tooltip="top"
      onclick={() => store.removeObject(vector.id)}
    />
  </div>
  <div class="sub">
    <div class="swatches" role="group" aria-label="{name} colour">
      {#each OBJECT_COLOR_KEYS as key (key)}
        <button
          type="button"
          class="swatch"
          style:--c="var(--color-object-{key})"
          aria-label={key}
          aria-pressed={key === colorKey}
          onclick={() => store.updateObject(vector.id, { colorKey: key }, 'commit')}
        ></button>
      {/each}
    </div>
    <span class="image">
      <span class="image-label">A{name}</span>
      <span class="image-value num" aria-label="Image A{name} = {image}">= {image}</span>
    </span>
  </div>
</li>

<style>
  .vector {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-2);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    background: var(--color-surface-inset);
    list-style: none;
    transition: opacity var(--duration-base) var(--ease-out);
  }

  .main {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .dot {
    flex-shrink: 0;
    width: 10px;
    height: 10px;
    margin: 0 var(--space-1);
    border-radius: 50%;
    background: var(--obj);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--obj) 22%, transparent);
  }

  .name {
    flex-shrink: 0;
    min-width: 22px;
    color: var(--obj);
    font-size: var(--text-sm);
    font-style: italic;
    font-weight: var(--weight-semibold);
  }

  .coords {
    display: grid;
    flex: 1;
    grid-template-columns: repeat(var(--n), minmax(0, 1fr));
    gap: 1px;
    min-width: 0;
    margin: 0 var(--space-1);
    padding: 2px;
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-sm);
    background: var(--color-surface-2);
  }

  .sub {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    min-height: 20px;
    padding: 0 var(--space-2) 0 var(--space-1);
  }

  .swatches {
    display: flex;
    gap: var(--space-2);
    padding-left: 1px;
  }

  .swatch {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--c);
    opacity: 0.55;
    transition:
      opacity var(--duration-fast) var(--ease-out),
      transform var(--duration-fast) var(--ease-out),
      box-shadow var(--duration-fast) var(--ease-out);
  }

  .swatch:hover {
    opacity: 1;
    transform: scale(1.1);
  }

  .swatch[aria-pressed='true'] {
    opacity: 1;
    box-shadow:
      0 0 0 2px var(--color-bg),
      0 0 0 3.5px var(--c);
  }

  .image {
    display: flex;
    align-items: baseline;
    gap: var(--space-1);
    min-width: 0;
    overflow: hidden;
    font-size: var(--text-xs);
    white-space: nowrap;
  }

  .image-label {
    color: var(--img);
    font-style: italic;
    font-weight: var(--weight-semibold);
  }

  .image-value {
    overflow: hidden;
    color: var(--color-text-muted);
    text-overflow: ellipsis;
  }

  .hidden .dot,
  .hidden .name,
  .hidden .coords,
  .hidden .sub {
    opacity: 0.45;
  }
</style>
