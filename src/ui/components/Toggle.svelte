<script lang="ts">
  interface Props {
    checked: boolean;
    onchange: (checked: boolean) => void;
    /** Accessible name (required even when a visible label sits next to the switch). */
    label: string;
    /** id of an element describing the setting. */
    describedBy?: string;
    disabled?: boolean;
    size?: 'sm' | 'md';
  }

  let { checked, onchange, label, describedBy, disabled = false, size = 'md' }: Props = $props();
</script>

<button
  type="button"
  role="switch"
  class="switch"
  data-size={size}
  aria-checked={checked}
  aria-label={label}
  aria-describedby={describedBy}
  {disabled}
  onclick={() => onchange(!checked)}
>
  <span class="thumb" aria-hidden="true"></span>
</button>

<style>
  .switch {
    --w: 34px;
    --h: 20px;
    --pad: 3px;
    position: relative;
    flex-shrink: 0;
    width: var(--w);
    height: var(--h);
    border-radius: var(--radius-pill);
    background: var(--color-surface-3);
    box-shadow: inset 0 0 0 1px var(--color-border-strong);
    transition:
      background-color var(--duration-base) var(--ease-out),
      box-shadow var(--duration-base) var(--ease-out);
  }

  .switch[data-size='sm'] {
    --w: 28px;
    --h: 16px;
    --pad: 2px;
  }

  .switch:hover:not(:disabled) {
    box-shadow: inset 0 0 0 1px var(--color-text-faint);
  }

  .switch[aria-checked='true'] {
    background: var(--color-accent);
    box-shadow: none;
  }

  .thumb {
    position: absolute;
    top: var(--pad);
    left: var(--pad);
    width: calc(var(--h) - 2 * var(--pad));
    height: calc(var(--h) - 2 * var(--pad));
    border-radius: 50%;
    background: var(--color-text);
    box-shadow: var(--shadow-sm);
    transition: transform var(--duration-base) var(--ease-spring);
  }

  [aria-checked='true'] .thumb {
    transform: translateX(calc(var(--w) - var(--h)));
  }

  .switch:active:not(:disabled) .thumb {
    width: calc(var(--h) - 2 * var(--pad) + 3px);
  }

  [aria-checked='true']:active:not(:disabled) .thumb {
    transform: translateX(calc(var(--w) - var(--h) - 3px));
  }

  .switch:disabled {
    opacity: 0.45;
  }
</style>
