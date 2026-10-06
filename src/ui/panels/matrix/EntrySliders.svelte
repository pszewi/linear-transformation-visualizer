<!-- One slider per entry in [−5, 5]: 'live' while dragging, 'end' on release. -->
<script lang="ts">
  import { formatNumber } from '../../../core/format';
  import { ACTIVE_TRANSFORM } from '../../../state/store.svelte';
  import type { SceneStore } from '../../../state/store.types';
  import Slider from '../../components/Slider.svelte';
  import { range, subscript } from '../../lib/text';

  interface Props {
    store: SceneStore;
  }

  let { store }: Props = $props();

  const node = $derived(store.doc.transforms[ACTIVE_TRANSFORM]);
  const entries = $derived(
    range(node.rows.length).flatMap((i) => range(node.rows[0].length).map((j) => ({ i, j }))),
  );
</script>

<div class="sliders">
  {#each entries as { i, j } (`${i}-${j}`)}
    {@const name = `a${subscript(`${i + 1}${j + 1}`)}`}
    <div class="entry">
      <span class="name">{name}</span>
      <Slider
        value={node.rows[i][j]}
        label="{name}, row {i + 1}, column {j + 1}"
        onchange={(v, phase) => store.setEntry(i, j, v, phase)}
      />
      <span class="value num">{formatNumber(node.rows[i][j], 2)}</span>
    </div>
  {/each}
</div>

<style>
  .sliders {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .entry {
    display: grid;
    grid-template-columns: 28px 1fr 44px;
    align-items: center;
    gap: var(--space-3);
    min-height: 28px;
  }

  .name {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-style: italic;
  }

  .value {
    color: var(--color-text);
    font-size: var(--text-xs);
    text-align: right;
  }
</style>
