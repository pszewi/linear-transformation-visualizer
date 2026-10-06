<!--
  Presentation of an Analysis. Pure function of its prop (no store access), so it can be
  rendered against fixtures (see ui/dev/FixtureGallery.svelte).
-->
<script lang="ts">
  import type { Analysis, Orientation } from '../../../core/analysis';
  import { formatNumber } from '../../../core/format';
  import Badge from '../../components/Badge.svelte';
  import Tex from '../../components/Math.svelte';
  import EigenSection from './EigenSection.svelte';
  import Group from './Group.svelte';
  import SubspaceRow from './SubspaceRow.svelte';

  interface Props {
    analysis: Analysis;
  }

  let { analysis }: Props = $props();

  const orientationCaption: Record<Orientation, string> = {
    preserving: 'Orientation preserved',
    reversing: 'Orientation reversed',
    degenerate: 'Space collapsed',
  };
  const orientationTone: Record<Orientation, 'positive' | 'negative' | 'warning'> = {
    preserving: 'positive',
    reversing: 'negative',
    degenerate: 'warning',
  };

  const rows = $derived(analysis.shape.rows);
  const cols = $derived(analysis.shape.cols);
  const measure = $derived(cols === 2 ? 'area' : 'volume');
  const detText = $derived(formatNumber(analysis.det ?? Number.NaN, 3));
  const traceText = $derived(formatNumber(analysis.trace ?? Number.NaN, 3));
</script>

<div class="analysis">
  {#if !analysis.square}
    <div class="shape">
      <Badge>{rows}×{cols}</Badge>
      <Tex tex={`A : \\mathbb{R}^{${cols}} \\to \\mathbb{R}^{${rows}}`} />
    </div>
  {/if}

  {#if analysis.square && analysis.det !== undefined && analysis.orientation}
    <div class="tiles">
      <div class="tile" data-tone={orientationTone[analysis.orientation]}>
        <span class="tile-label">det <i>A</i></span>
        <span class="tile-value num" class:long={detText.length > 7} title={detText}>{detText}</span
        >
        <span class="tile-caption">{orientationCaption[analysis.orientation]}</span>
      </div>
      <div class="tile">
        <span class="tile-label">tr <i>A</i></span>
        <span class="tile-value num" class:long={traceText.length > 7} title={traceText}
          >{traceText}</span
        >
        <span class="tile-caption">Sum of eigenvalues</span>
      </div>
    </div>
    <p class="det-note">
      {#if analysis.orientation === 'degenerate'}
        The unit {cols === 2 ? 'square' : 'cube'} is flattened to zero {measure}.
      {:else}
        Every {measure} is scaled by |det| = {formatNumber(Math.abs(analysis.det), 3)}.
      {/if}
    </p>
  {/if}

  <div class="facts">
    <div class="fact">
      <span class="fact-label">Rank</span>
      <span class="fact-value num">{analysis.rank}</span>
    </div>
    <div class="fact">
      <span class="fact-label">Nullity</span>
      <span class="fact-value num">{analysis.nullity}</span>
    </div>
    {#if analysis.invertible !== undefined}
      <Badge tone={analysis.invertible ? 'positive' : 'negative'}>
        {analysis.invertible ? 'Invertible' : 'Singular'}
      </Badge>
    {/if}
  </div>
  <p class="rank-nullity">
    Rank–nullity: <span class="num">{analysis.rank} + {analysis.nullity} = {cols}</span>
  </p>

  {#if analysis.square}
    {#if analysis.eigen}
      <EigenSection eigen={analysis.eigen} />
    {/if}
  {:else}
    <p class="note">det, trace and eigenvalues are defined for square matrices only.</p>
  {/if}

  <Group title="Kernel & image">
    <SubspaceRow
      name="ker A"
      dim={analysis.nullity}
      ambient={cols}
      basis={analysis.kernelBasis}
      trivial="Only the zero vector maps to 0"
    />
    <SubspaceRow
      name="im A"
      dim={analysis.rank}
      ambient={rows}
      basis={analysis.imageBasis}
      trivial="Everything collapses to the origin"
    />
  </Group>
</div>

<style>
  .analysis {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .shape {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-text-muted);
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .tile {
    --tone: var(--color-text);
    display: flex;
    flex-direction: column;
    gap: var(--space-0);
    min-width: 0;
    padding: var(--space-2) var(--space-3) var(--space-3);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    background: var(--color-surface-inset);
  }

  .tile[data-tone='positive'] {
    --tone: var(--color-positive);
  }
  .tile[data-tone='negative'] {
    --tone: var(--color-negative);
  }
  .tile[data-tone='warning'] {
    --tone: var(--color-warning);
  }

  .tile-label {
    color: var(--color-text-faint);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
  }

  .tile-value {
    overflow: hidden;
    color: var(--tone);
    font-size: var(--text-2xl);
    font-weight: var(--weight-medium);
    line-height: var(--leading-tight);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tile-value.long {
    font-size: var(--text-lg);
    line-height: calc(var(--text-2xl) * var(--leading-tight));
  }

  .tile-caption {
    overflow: hidden;
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tile[data-tone] .tile-caption {
    color: var(--tone);
    opacity: 0.85;
  }

  .det-note,
  .note {
    color: var(--color-text-faint);
    font-size: var(--text-xs);
  }

  .det-note {
    margin-top: calc(-1 * var(--space-1));
  }

  .facts {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding-top: var(--space-3);
    border-top: 1px solid var(--color-border-subtle);
  }

  .fact {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }

  .facts :global(.badge) {
    margin-left: auto;
  }

  .fact-label {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .fact-value {
    font-size: var(--text-lg);
    font-weight: var(--weight-medium);
  }

  .rank-nullity {
    margin-top: calc(-1 * var(--space-2));
    color: var(--color-text-faint);
    font-size: var(--text-xs);
  }
</style>
