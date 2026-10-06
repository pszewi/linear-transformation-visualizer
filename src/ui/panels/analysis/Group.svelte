<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    aside?: Snippet;
    children: Snippet;
  }

  let { title, aside, children }: Props = $props();
</script>

<div class="group">
  <div class="head">
    <h4>{title}</h4>
    {#if aside}{@render aside()}{/if}
  </div>
  {@render children()}
</div>

<style>
  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding-top: var(--space-3);
    border-top: 1px solid var(--color-border-subtle);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    min-height: 20px;
  }

  h4 {
    color: var(--color-text-faint);
    font-size: var(--text-2xs);
    font-weight: var(--weight-semibold);
    letter-spacing: var(--tracking-caps);
    text-transform: uppercase;
  }
</style>
