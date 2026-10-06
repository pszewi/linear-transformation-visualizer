<script lang="ts">
  interface Props {
    /** One key per entry, e.g. ['⌘', 'Z']. */
    keys: readonly string[];
    size?: 'sm' | 'md';
  }

  let { keys, size = 'sm' }: Props = $props();
</script>

<span class="combo" data-size={size}>
  {#each keys as key, k (k)}
    <kbd>{key}</kbd>
  {/each}
</span>

<style>
  .combo {
    display: inline-flex;
    gap: var(--space-0);
    vertical-align: middle;
  }

  kbd {
    display: inline-grid;
    place-items: center;
    min-width: 18px;
    height: 18px;
    padding: 0 var(--space-1);
    border: 1px solid var(--color-border-strong);
    border-bottom-width: 2px;
    border-radius: var(--radius-xs);
    background: var(--color-surface-2);
    color: var(--color-text-muted);
    font-family: var(--font-sans);
    font-size: var(--text-2xs);
    font-weight: var(--weight-medium);
    line-height: 1;
  }

  [data-size='md'] kbd {
    min-width: 24px;
    height: 24px;
    padding: 0 var(--space-2);
    font-size: var(--text-xs);
  }
</style>
