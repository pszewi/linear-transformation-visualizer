<!-- Vertical scroll container whose top/bottom edges fade out only when there is more to see. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
    /** Exposed so parents can scroll a child into view. */
    element?: HTMLDivElement;
    label?: string;
  }

  let { children, element = $bindable(), label }: Props = $props();

  let content = $state<HTMLDivElement>();
  let fadeTop = $state(false);
  let fadeBottom = $state(false);

  function update() {
    if (!element) return;
    const { scrollTop, scrollHeight, clientHeight } = element;
    fadeTop = scrollTop > 1;
    fadeBottom = scrollTop + clientHeight < scrollHeight - 1;
  }

  $effect(() => {
    if (!element || !content) return;
    // Observe the scroller (viewport size) and the content (sections opening/closing). A
    // ResizeObserver fires only on real size changes and after layout, so live panel updates
    // (e.g. KaTeX re-rendering on every drag frame) never force a synchronous layout here.
    const resize = new ResizeObserver(update);
    resize.observe(element);
    resize.observe(content);
    update();
    return () => resize.disconnect();
  });
</script>

<div
  class="scroll"
  class:fade-top={fadeTop}
  class:fade-bottom={fadeBottom}
  bind:this={element}
  onscroll={update}
  role="region"
  aria-label={label}
>
  <div class="content" bind:this={content}>
    {@render children()}
  </div>
</div>

<style>
  .scroll {
    --fade: 24px;
    --top: 0px;
    --bottom: 0px;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    mask-image: linear-gradient(
      to bottom,
      transparent 0,
      var(--mask-solid) var(--top),
      var(--mask-solid) calc(100% - var(--bottom)),
      transparent 100%
    );
  }

  .fade-top {
    --top: var(--fade);
  }

  .fade-bottom {
    --bottom: var(--fade);
  }
</style>
