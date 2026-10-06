<script lang="ts">
  import type { EigenResult } from '../../../core/analysis';
  import { complexToLatex } from '../../../core/format';
  import Badge from '../../components/Badge.svelte';
  import Icon from '../../components/Icon.svelte';
  import Tex from '../../components/Math.svelte';
  import Tooltip from '../../components/Tooltip.svelte';
  import Group from './Group.svelte';
  import { eigenvalueTex, isReal, spanTex } from './tex';

  interface Props {
    eigen: EigenResult;
  }

  let { eigen }: Props = $props();

  const realSpaces = $derived(eigen.spaces.filter((s) => isReal(s.value) && s.basis.length > 0));
  const hasComplex = $derived(eigen.spaces.some((s) => !isReal(s.value)));

  const DEFECTIVE_HELP =
    'An eigenvalue is defective when its geometric multiplicity (independent eigenvectors, ' +
    'dim ker(A − λI)) is smaller than its algebraic multiplicity (how often it is a root of ' +
    'the characteristic polynomial). Then A has too few eigenvectors to be diagonalised.';
</script>

<Group title="Eigenvalues">
  {#snippet aside()}
    {#if eigen.defective}
      <Tooltip text={DEFECTIVE_HELP} wide placement="left">
        {#snippet children({ describedBy })}
          <Badge tone="warning" tabindex={0} aria-describedby={describedBy}>
            Defective <Icon name="info" size={11} strokeWidth={2.25} />
          </Badge>
        {/snippet}
      </Tooltip>
    {/if}
  {/snippet}

  {#if eigen.spaces.length === 0}
    <p class="note">Eigenvalues unavailable.</p>
  {:else}
    <ul class="chips">
      {#each eigen.spaces as space, k (k)}
        <li class="chip" class:complex={!isReal(space.value)}>
          <Tex tex={eigenvalueTex(k + 1, space.value)} />
          {#if space.algebraicMultiplicity > 1}
            <span
              class="mult num"
              title="Algebraic multiplicity {space.algebraicMultiplicity}"
              aria-label="multiplicity {space.algebraicMultiplicity}"
              >×{space.algebraicMultiplicity}</span
            >
          {/if}
        </li>
      {/each}
    </ul>
    {#if hasComplex}
      <p class="note">
        Complex eigenvalues come in conjugate pairs: A turns a plane, so no real vector there keeps
        its direction.
      </p>
    {/if}
  {/if}
</Group>

{#if realSpaces.length > 0}
  <Group title="Eigenspaces">
    <ul class="spaces">
      {#each realSpaces as space, k (k)}
        {@const short = space.geometricMultiplicity < space.algebraicMultiplicity}
        <li class="space">
          <div class="space-head">
            <Tex tex={`\\lambda = ${complexToLatex(space.value, 3)}`} />
            <span class="dims" class:short>
              dim <span class="num">{space.geometricMultiplicity}</span>
              {#if space.algebraicMultiplicity > 1 || short}
                <span class="of">of {space.algebraicMultiplicity}</span>
              {/if}
            </span>
          </div>
          <div class="basis"><Tex tex={spanTex(space.basis)} /></div>
        </li>
      {/each}
    </ul>
  </Group>
{/if}

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    list-style: none;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    height: 30px;
    padding: 0 var(--space-3);
    border: 1px solid transparent;
    border-radius: var(--radius-pill);
    background: var(--color-warning-soft);
    color: var(--color-eigen);
  }

  .chip.complex {
    border-color: var(--color-border-strong);
    border-style: dashed;
    background: transparent;
    color: var(--color-text);
  }

  .mult {
    padding: 1px 6px;
    border-radius: var(--radius-pill);
    background: var(--color-overlay-active);
    color: var(--color-text);
    font-size: var(--text-2xs);
    font-weight: var(--weight-semibold);
  }

  .note {
    color: var(--color-text-faint);
    font-size: var(--text-xs);
  }

  .spaces {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    list-style: none;
  }

  .space {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    background: var(--color-surface-inset);
  }

  .space-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--color-eigen);
  }

  .dims {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
  }

  .dims.short {
    color: var(--color-warning);
  }

  .of {
    color: var(--color-text-faint);
  }

  .basis {
    overflow-x: auto;
    color: var(--color-text);
  }
</style>
