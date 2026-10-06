<script lang="ts">
  // Static mark; no props.
</script>

<!-- App mark: the unit square and its image under a shear, in the accent colour. -->
<svg class="mark" width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" focusable="false">
  <rect class="tile" x="0.5" y="0.5" width="27" height="27" rx="8" />
  <path class="square" d="M7 21V12h9v9Z" />
  <path class="image" d="M7 21l5-12h10l-5 12Z" />
  <circle class="origin" cx="7" cy="21" r="1.6" />
</svg>

<style>
  .mark {
    flex-shrink: 0;
  }

  .tile {
    fill: var(--color-accent-soft);
    stroke: var(--color-border-subtle);
  }

  .square {
    fill: none;
    stroke: var(--color-text-faint);
    stroke-width: 1.25;
    stroke-dasharray: 2 2;
  }

  .image {
    fill: var(--color-accent-soft);
    stroke: var(--color-accent);
    stroke-width: 1.75;
    stroke-linejoin: round;
  }

  .origin {
    fill: var(--color-text);
  }
</style>
