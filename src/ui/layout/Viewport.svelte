<!-- Full-bleed host element for the engine's canvas. The engine owns everything inside it. -->
<script lang="ts">
  interface Props {
    host?: HTMLElement;
  }

  let { host = $bindable() }: Props = $props();
</script>

<main class="viewport" bind:this={host} aria-label="Transformation view"></main>

<style>
  .viewport {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: var(--color-bg);
    /* Subtle vignette so the floating panels sit on depth even before the scene draws. */
    background-image: radial-gradient(
      ellipse at 40% 45%,
      var(--color-bg) 0%,
      var(--color-bg) 55%,
      var(--color-surface-inset) 100%
    );
    touch-action: none;
  }

  .viewport :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
