<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';
  import Tooltip from './Tooltip.svelte';

  interface Props extends Omit<HTMLButtonAttributes, 'aria-label'> {
    /** Accessible name; also the tooltip text. */
    label: string;
    icon: IconName;
    shortcut?: readonly string[];
    tooltip?: 'top' | 'bottom' | 'left' | 'right' | 'none';
    size?: 'sm' | 'md';
    /** Toggle-button state (sets aria-pressed). */
    pressed?: boolean;
    /** Accent tint for destructive/active affordances on hover. */
    tone?: 'default' | 'danger';
  }

  let {
    label,
    icon,
    shortcut,
    tooltip = 'bottom',
    size = 'md',
    pressed,
    tone = 'default',
    type = 'button',
    ...rest
  }: Props = $props();
</script>

{#snippet button(_tip?: { describedBy: string })}
  <button
    class="icon-btn"
    data-size={size}
    data-tone={tone}
    aria-label={label}
    aria-pressed={pressed}
    {type}
    {...rest}
  >
    <Icon name={icon} size={size === 'sm' ? 14 : 16} />
  </button>
{/snippet}

{#if tooltip === 'none'}
  {@render button()}
{:else}
  <Tooltip text={label} placement={tooltip} {shortcut} children={button} />
{/if}

<style>
  .icon-btn {
    display: inline-grid;
    place-items: center;
    width: var(--control-height);
    height: var(--control-height);
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    transition:
      background-color var(--duration-fast) var(--ease-out),
      color var(--duration-fast) var(--ease-out),
      transform var(--duration-fast) var(--ease-out);
  }

  .icon-btn[data-size='sm'] {
    width: var(--control-height-sm);
    height: var(--control-height-sm);
    border-radius: var(--radius-xs);
  }

  .icon-btn:hover:not(:disabled) {
    background: var(--color-overlay-hover);
    color: var(--color-text);
  }

  .icon-btn:active:not(:disabled) {
    background: var(--color-overlay-active);
    transform: scale(0.94);
  }

  .icon-btn[data-tone='danger']:hover:not(:disabled) {
    background: var(--color-negative-soft);
    color: var(--color-negative);
  }

  .icon-btn[aria-pressed='true'] {
    background: var(--color-accent-soft);
    color: var(--color-accent);
  }

  .icon-btn:disabled {
    opacity: 0.35;
  }
</style>
