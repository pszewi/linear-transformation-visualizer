<!--
  Styled native range input (keeps native keyboard + a11y). The filled track runs from zero
  (or `min`, if zero is outside the range) to the value. `input` → 'live', `change` → 'end'.
-->
<script lang="ts">
  interface Props {
    value: number;
    onchange: (value: number, phase: 'live' | 'end') => void;
    label: string;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
  }

  let {
    value,
    onchange,
    label,
    min = -5,
    max = 5,
    step = 0.01,
    disabled = false,
  }: Props = $props();

  const pct = (x: number) => ((Math.min(max, Math.max(min, x)) - min) / (max - min)) * 100;
  const origin = $derived(pct(min <= 0 && max >= 0 ? 0 : min));
  const at = $derived(pct(value));
</script>

<input
  class="slider"
  type="range"
  {min}
  {max}
  {step}
  {value}
  {disabled}
  aria-label={label}
  style:--from="{Math.min(origin, at)}%"
  style:--to="{Math.max(origin, at)}%"
  oninput={(e) => onchange(Number(e.currentTarget.value), 'live')}
  onchange={(e) => onchange(Number(e.currentTarget.value), 'end')}
/>

<style>
  .slider {
    --track-h: 4px;
    --thumb: 14px;
    --track: linear-gradient(
      to right,
      var(--color-surface-3) var(--from),
      var(--color-accent) var(--from),
      var(--color-accent) var(--to),
      var(--color-surface-3) var(--to)
    );
    width: 100%;
    height: 20px;
    margin: 0;
    background: transparent;
    cursor: pointer;
    appearance: none;
    touch-action: pan-y;
  }

  .slider:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .slider::-webkit-slider-runnable-track {
    height: var(--track-h);
    border-radius: var(--radius-pill);
    background: var(--track);
  }

  .slider::-moz-range-track {
    height: var(--track-h);
    border-radius: var(--radius-pill);
    background: var(--track);
  }

  .slider::-webkit-slider-thumb {
    width: var(--thumb);
    height: var(--thumb);
    margin-top: calc((var(--track-h) - var(--thumb)) / 2);
    border: 2px solid var(--color-surface-1);
    border-radius: 50%;
    background: var(--color-accent);
    box-shadow: var(--shadow-sm);
    appearance: none;
    transition:
      transform var(--duration-fast) var(--ease-out),
      box-shadow var(--duration-fast) var(--ease-out);
  }

  .slider::-moz-range-thumb {
    width: var(--thumb);
    height: var(--thumb);
    border: 2px solid var(--color-surface-1);
    border-radius: 50%;
    background: var(--color-accent);
    box-shadow: var(--shadow-sm);
    transition:
      transform var(--duration-fast) var(--ease-out),
      box-shadow var(--duration-fast) var(--ease-out);
  }

  .slider:hover:not(:disabled)::-webkit-slider-thumb {
    transform: scale(1.15);
  }
  .slider:hover:not(:disabled)::-moz-range-thumb {
    transform: scale(1.15);
  }

  .slider:active:not(:disabled)::-webkit-slider-thumb {
    transform: scale(1.2);
    box-shadow: 0 0 0 5px var(--color-accent-soft);
  }
  .slider:active:not(:disabled)::-moz-range-thumb {
    transform: scale(1.2);
    box-shadow: 0 0 0 5px var(--color-accent-soft);
  }

  .slider:focus-visible {
    outline: none;
  }
  .slider:focus-visible::-webkit-slider-thumb {
    box-shadow: 0 0 0 3px var(--color-focus-ring);
  }
  .slider:focus-visible::-moz-range-thumb {
    box-shadow: 0 0 0 3px var(--color-focus-ring);
  }
</style>
