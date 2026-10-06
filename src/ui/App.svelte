<!-- PLACEHOLDER (head agent): replaced during integration. -->
<script lang="ts">
  import { createEngine } from '../engine';

  const engine = createEngine();
  let host: HTMLDivElement;

  $effect(() => {
    engine.mount(host);
    return () => engine.dispose();
  });
</script>

<div class="viewport" bind:this={host}></div>

<style>
  .viewport {
    position: fixed;
    inset: 0;
    background: var(--color-bg);
  }
</style>
