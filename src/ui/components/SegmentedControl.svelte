<!--
  Radio group rendered as segments with a sliding pill indicator. Roving tabindex:
  Tab focuses the selected segment, arrow keys / Home / End move and select.
-->
<script lang="ts" generics="T extends string">
  import type { SegmentOption } from './types';

  interface Props {
    options: readonly SegmentOption<T>[];
    value: T;
    onchange: (value: T) => void;
    /** Accessible name of the group. */
    label: string;
    size?: 'sm' | 'md';
    block?: boolean;
  }

  let { options, value, onchange, label, size = 'md', block = false }: Props = $props();

  const index = $derived(
    Math.max(
      0,
      options.findIndex((o) => o.value === value),
    ),
  );
  let buttons: HTMLButtonElement[] = $state([]);

  function select(k: number, focus: boolean) {
    const option = options[(k + options.length) % options.length];
    if (option.value !== value) onchange(option.value);
    if (focus) buttons[options.indexOf(option)]?.focus();
  }

  function onkeydown(e: KeyboardEvent) {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      Home: 0,
      End: options.length - 1,
    };
    const target = moves[e.key];
    if (target === undefined) return;
    e.preventDefault();
    select(target, true);
  }
</script>

<div
  class="segmented"
  class:block
  data-size={size}
  role="radiogroup"
  aria-label={label}
  style:--count={options.length}
  style:--index={index}
>
  <span class="pill" aria-hidden="true"></span>
  {#each options as option, k (option.value)}
    <button
      bind:this={buttons[k]}
      type="button"
      role="radio"
      aria-checked={k === index}
      aria-label={option.ariaLabel}
      tabindex={k === index ? 0 : -1}
      onclick={() => select(k, false)}
      {onkeydown}
    >
      {option.label}
    </button>
  {/each}
</div>

<style>
  .segmented {
    position: relative;
    display: inline-grid;
    grid-template-columns: repeat(var(--count), minmax(0, 1fr));
    padding: 3px;
    border-radius: var(--radius-sm);
    background: var(--color-surface-inset);
    box-shadow: inset 0 0 0 1px var(--color-border-subtle);
    isolation: isolate;
  }

  .block {
    display: grid;
    width: 100%;
  }

  .pill {
    position: absolute;
    z-index: -1;
    top: 3px;
    bottom: 3px;
    left: 3px;
    width: calc((100% - 6px) / var(--count));
    border-radius: var(--radius-xs);
    background: var(--color-surface-3);
    box-shadow: var(--shadow-sm), var(--shadow-inset-top);
    transform: translateX(calc(100% * var(--index)));
    transition: transform var(--duration-slow) var(--ease-spring);
  }

  button {
    height: calc(var(--control-height) - 6px);
    min-width: 40px;
    padding: 0 var(--space-3);
    border-radius: var(--radius-xs);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    white-space: nowrap;
    transition: color var(--duration-base) var(--ease-out);
  }

  [data-size='sm'] button {
    height: calc(var(--control-height-sm) - 6px);
    min-width: 32px;
    padding: 0 var(--space-2);
    font-size: var(--text-xs);
  }

  button:hover {
    color: var(--color-text);
  }

  button[aria-checked='true'] {
    color: var(--color-text);
  }

  button:focus-visible {
    outline-offset: 0;
  }
</style>
