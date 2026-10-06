<!-- Dev-only (/?fixtures): AnalysisView rendered against every fixture, at sidebar width. -->
<script lang="ts">
  import Section from '../components/Section.svelte';
  import AnalysisView from '../panels/analysis/AnalysisView.svelte';
  import MiniMatrix from '../panels/MiniMatrix.svelte';
  import { FIXTURES } from './fixtures';
</script>

<div class="gallery">
  {#each FIXTURES as fixture (fixture.name)}
    <div class="card glass">
      <div class="caption">
        <span>{fixture.name}</span>
        <MiniMatrix rows={fixture.rows} />
      </div>
      <Section title="Analysis" icon="sigma">
        <AnalysisView analysis={fixture.analysis} />
      </Section>
    </div>
  {/each}
</div>

<style>
  .gallery {
    position: fixed;
    inset: 0;
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    align-items: flex-start;
    gap: var(--space-4);
    padding: var(--space-4);
    overflow: auto;
  }

  .card {
    width: var(--sidebar-width);
    padding: var(--space-2);
    border-radius: var(--radius-xl);
  }

  .caption {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-1) var(--space-2) var(--space-2);
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
  }
</style>
