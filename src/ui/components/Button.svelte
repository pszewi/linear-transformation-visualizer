<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';

  interface Props extends HTMLButtonAttributes {
    variant?: 'primary' | 'ghost' | 'subtle';
    size?: 'sm' | 'md';
    icon?: IconName;
    /** Stretch to the container width. */
    block?: boolean;
    children?: Snippet;
  }

  let {
    variant = 'subtle',
    size = 'md',
    icon,
    block = false,
    type = 'button',
    children,
    ...rest
  }: Props = $props();
</script>

<button class="btn" data-variant={variant} data-size={size} class:block {type} {...rest}>
  {#if icon}<Icon name={icon} size={size === 'sm' ? 14 : 16} />{/if}
  {#if children}<span class="label">{@render children()}</span>{/if}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    height: var(--control-height);
    padding: 0 var(--space-3);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    line-height: 1;
    white-space: nowrap;
    user-select: none;
    transition:
      background-color var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out),
      color var(--duration-fast) var(--ease-out),
      transform var(--duration-fast) var(--ease-out);
  }

  .btn[data-size='sm'] {
    height: var(--control-height-sm);
    padding: 0 var(--space-2);
    gap: var(--space-1);
    font-size: var(--text-xs);
  }

  .block {
    display: flex;
    width: 100%;
  }

  .btn:active:not(:disabled) {
    transform: scale(0.97);
  }

  .btn:disabled {
    opacity: 0.45;
  }

  .label {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* primary: filled accent */
  [data-variant='primary'] {
    background: var(--color-accent);
    color: var(--color-on-accent);
  }
  [data-variant='primary']:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }

  /* subtle: quiet filled surface with a hairline border */
  [data-variant='subtle'] {
    background: var(--color-surface-2);
    border-color: var(--color-border-subtle);
    color: var(--color-text);
    box-shadow: var(--shadow-inset-top);
  }
  [data-variant='subtle']:hover:not(:disabled) {
    background: var(--color-surface-3);
  }

  /* ghost: text only until hovered */
  [data-variant='ghost'] {
    color: var(--color-text-muted);
  }
  [data-variant='ghost']:hover:not(:disabled) {
    background: var(--color-overlay-hover);
    color: var(--color-text);
  }
  [data-variant='ghost']:active:not(:disabled) {
    background: var(--color-overlay-active);
  }
</style>
