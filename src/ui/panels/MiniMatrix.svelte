<!-- Tiny read-only matrix preview (presets). -->
<script lang="ts">
  import { formatNumber } from '../../core/format';

  interface Props {
    rows: readonly (readonly number[])[];
  }

  let { rows }: Props = $props();
</script>

<span class="mini num" style:--cols={rows[0].length} aria-hidden="true">
  {#each rows as row, i (i)}
    {#each row as x, j (j)}
      <span class:zero={x === 0}>{formatNumber(x, 2)}</span>
    {/each}
  {/each}
</span>

<style>
  .mini {
    position: relative;
    display: inline-grid;
    grid-template-columns: repeat(var(--cols), auto);
    column-gap: 0.7em;
    row-gap: 1px;
    padding: 2px 6px;
    color: var(--color-text-muted);
    font-size: var(--text-2xs);
    line-height: 1.25;
    text-align: right;
  }

  .mini::before,
  .mini::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 3px;
    border: 1px solid var(--color-text-faint);
  }

  .mini::before {
    left: 0;
    border-right: none;
    border-radius: 2px 0 0 2px;
  }

  .mini::after {
    right: 0;
    border-left: none;
    border-radius: 0 2px 2px 0;
  }

  .zero {
    color: var(--color-text-faint);
  }
</style>
