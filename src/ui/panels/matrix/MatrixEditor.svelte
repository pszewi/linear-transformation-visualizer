<!--
  The matrix as large scrubbable cells between drawn brackets. Each cell reads only its own
  entry, so scrubbing one entry re-renders one cell. Hovering a cell highlights its row and
  column; columns are tagged with the basis vector they are the image of.
-->
<script lang="ts">
  import { ACTIVE_TRANSFORM } from '../../../state/store.svelte';
  import type { SceneStore } from '../../../state/store.types';
  import ScrubNumber from '../../components/ScrubNumber.svelte';
  import { range, subscript } from '../../lib/text';

  interface Props {
    store: SceneStore;
  }

  let { store }: Props = $props();

  const node = $derived(store.doc.transforms[ACTIVE_TRANSFORM]);
  const rowIdx = $derived(range(node.rows.length));
  const colIdx = $derived(range(node.rows[0].length));
  let hover = $state<{ i: number; j: number } | null>(null);
</script>

<div class="editor" data-cols={colIdx.length}>
  <span class="name" aria-hidden="true">{node.label}<span class="eq">=</span></span>
  <div
    class="matrix"
    role="grid"
    aria-label="Matrix {node.label}, {rowIdx.length} by {colIdx.length}"
    style:--cols={colIdx.length}
  >
    <span class="bracket left" aria-hidden="true"></span>
    <div class="cells">
      {#each rowIdx as i (i)}
        <div class="row" role="row">
          {#each colIdx as j (j)}
            <div
              class="cell"
              role="gridcell"
              class:hl={hover !== null && (hover.i === i || hover.j === j)}
            >
              <ScrubNumber
                value={node.rows[i][j]}
                onchange={(v, phase) => store.setEntry(i, j, v, phase)}
                label="a{subscript(`${i + 1}${j + 1}`)}, row {i + 1}, column {j + 1}"
                size="lg"
                onhover={(on) => (hover = on ? { i, j } : null)}
              />
            </div>
          {/each}
        </div>
      {/each}
    </div>
    <span class="bracket right" aria-hidden="true"></span>
  </div>
  <div class="col-tags" style:--cols={colIdx.length} aria-hidden="true">
    {#each colIdx as j (j)}
      <span class="tag" class:hl={hover?.j === j} style:--c="var(--color-basis-{j + 1})"
        >A<i>e</i>{subscript(j + 1)}</span
      >
    {/each}
  </div>
</div>

<style>
  .editor {
    --cell-w: 76px;
    --bracket-w: 8px;
    display: grid;
    grid-template-columns: auto auto;
    grid-template-areas:
      'name matrix'
      '. tags';
    align-items: center;
    justify-content: center;
    column-gap: var(--space-3);
    row-gap: var(--space-1);
    padding-top: var(--space-2);
  }

  .editor[data-cols='3'] {
    --cell-w: 64px;
  }

  .name {
    grid-area: name;
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    color: var(--color-text-muted);
    font-family: var(--font-sans);
    font-size: var(--text-xl);
    font-style: italic;
    font-weight: var(--weight-medium);
  }

  .eq {
    color: var(--color-text-faint);
    font-style: normal;
  }

  .matrix {
    grid-area: matrix;
    display: flex;
    align-items: stretch;
    gap: var(--space-1);
  }

  .bracket {
    width: var(--bracket-w);
    border: 1.5px solid var(--color-text-faint);
  }

  .bracket.left {
    border-right: none;
    border-radius: var(--radius-xs) 0 0 var(--radius-xs);
  }

  .bracket.right {
    border-left: none;
    border-radius: 0 var(--radius-xs) var(--radius-xs) 0;
  }

  .cells {
    display: flex;
    flex-direction: column;
    gap: var(--space-0);
    padding: var(--space-1) 0;
  }

  .row {
    display: grid;
    grid-template-columns: repeat(var(--cols), var(--cell-w));
    gap: var(--space-0);
  }

  .cell {
    border-radius: var(--radius-sm);
    transition: background-color var(--duration-fast) var(--ease-out);
  }

  .cell.hl {
    background: var(--color-overlay-hover);
  }

  .col-tags {
    grid-area: tags;
    display: grid;
    grid-template-columns: repeat(var(--cols), var(--cell-w));
    gap: var(--space-0);
    padding: 0 calc(var(--bracket-w) + var(--space-1));
  }

  .tag {
    justify-self: center;
    color: var(--c);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    opacity: 0.7;
    transition: opacity var(--duration-fast) var(--ease-out);
  }

  .tag.hl {
    opacity: 1;
  }

  .tag i {
    font-family: var(--font-sans);
  }
</style>
