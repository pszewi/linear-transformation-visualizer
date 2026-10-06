<!-- One subspace (kernel, image, eigenspace): name, dimension and a basis if known. -->
<script lang="ts">
  import type { Vec } from '../../../core/linalg/matrix';
  import Tex from '../../components/Math.svelte';
  import { spanTex } from './tex';

  interface Props {
    name: string;
    dim: number;
    /** Dimension of the space this subspace lives in. */
    ambient: number;
    basis: readonly Vec[];
    /** Caption for the zero subspace. */
    trivial: string;
  }

  let { name, dim, ambient, basis, trivial }: Props = $props();

  const tex = $derived.by(() => {
    if (dim === 0) return '\\{\\mathbf{0}\\}';
    if (dim === ambient) return `\\mathbb{R}^{${ambient}}`;
    return basis.length > 0 ? spanTex(basis) : null;
  });
</script>

<div class="row">
  <span class="name">{name}</span>
  <span class="dim">dim <span class="num">{dim}</span></span>
  <span class="value">
    {#if tex}<Tex {tex} />{/if}
    {#if dim === 0}<span class="caption">{trivial}</span>{/if}
  </span>
</div>

<style>
  .row {
    display: grid;
    grid-template-columns: 44px 44px minmax(0, 1fr);
    align-items: center;
    gap: var(--space-2);
    min-height: 28px;
  }

  .name {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-style: italic;
  }

  .dim {
    color: var(--color-text-faint);
    font-size: var(--text-xs);
  }

  .value {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    overflow-x: auto;
    color: var(--color-text);
  }

  .caption {
    color: var(--color-text-faint);
    font-size: var(--text-xs);
  }
</style>
