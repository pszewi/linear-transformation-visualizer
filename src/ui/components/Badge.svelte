<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  interface Props extends HTMLAttributes<HTMLSpanElement> {
    tone?: 'neutral' | 'positive' | 'negative' | 'warning' | 'accent';
    children: Snippet;
  }

  let { tone = 'neutral', children, ...rest }: Props = $props();
</script>

<span class="badge" data-tone={tone} {...rest}>{@render children()}</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    height: 20px;
    padding: 0 var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--color-surface-2);
    color: var(--color-text-muted);
    font-size: var(--text-2xs);
    font-weight: var(--weight-semibold);
    letter-spacing: 0.01em;
    white-space: nowrap;
  }

  [data-tone='positive'] {
    background: var(--color-positive-soft);
    color: var(--color-positive);
  }
  [data-tone='negative'] {
    background: var(--color-negative-soft);
    color: var(--color-negative);
  }
  [data-tone='warning'] {
    background: var(--color-warning-soft);
    color: var(--color-warning);
  }
  [data-tone='accent'] {
    background: var(--color-accent-soft);
    color: var(--color-accent-hover);
  }

  .badge:focus-visible {
    outline-offset: 1px;
  }
</style>
