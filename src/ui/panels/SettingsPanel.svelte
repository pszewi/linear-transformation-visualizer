<script lang="ts">
  import type { InterpolationMode } from '../../core/linalg/interpolate';
  import type { SceneStore } from '../../state/store.types';
  import SegmentedControl from '../components/SegmentedControl.svelte';
  import type { SegmentOption } from '../components/types';

  interface Props {
    store: SceneStore;
  }

  let { store }: Props = $props();

  const options: SegmentOption<InterpolationMode>[] = [
    { value: 'linear', label: 'Linear' },
    { value: 'polar', label: 'Polar' },
  ];

  const explanations: Record<InterpolationMode, string> = {
    linear:
      'Blends the entries directly: every point travels in a straight line to its image. ' +
      'Rotations shrink through the middle on the way.',
    polar:
      'Splits each matrix into rotation × stretch and blends those separately, so rotations ' +
      'turn smoothly instead of collapsing. Falls back to linear for reflections and singular maps.',
  };
</script>

<div class="setting">
  <div class="head">
    <span class="label">Transition</span>
    <SegmentedControl
      {options}
      value={store.doc.view.interpolation}
      onchange={(mode) => store.setInterpolation(mode)}
      label="Interpolation for animated changes"
      size="sm"
    />
  </div>
  <ul class="modes">
    {#each options as option (option.value)}
      <li class:active={store.doc.view.interpolation === option.value}>
        <span class="mode">{option.label}</span>
        <span class="explain">{explanations[option.value]}</span>
      </li>
    {/each}
  </ul>
</div>

<style>
  .setting {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .label {
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  .modes {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    list-style: none;
  }

  .modes li {
    display: flex;
    flex-direction: column;
    gap: var(--space-0);
    padding: var(--space-2) var(--space-3);
    border-left: 2px solid var(--color-border);
    color: var(--color-text-faint);
    transition:
      border-color var(--duration-base) var(--ease-out),
      color var(--duration-base) var(--ease-out);
  }

  .modes li.active {
    border-color: var(--color-accent);
    color: var(--color-text-muted);
  }

  .mode {
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
  }

  .active .mode {
    color: var(--color-text);
  }

  .explain {
    font-size: var(--text-xs);
    line-height: var(--leading-normal);
  }
</style>
