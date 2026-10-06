<!--
  Renders KaTeX source. `tex` must be built from core/format.ts builders (plus static TeX);
  never pass user-entered text. KaTeX escapes its input and `trust` is off, so commands like
  \href or \htmlClass are rejected.
-->
<script lang="ts">
  import katex from 'katex';

  interface Props {
    tex: string;
    display?: boolean;
  }

  let { tex, display = false }: Props = $props();

  const html = $derived(
    katex.renderToString(tex, {
      throwOnError: false,
      displayMode: display,
      trust: false,
      strict: 'ignore',
      output: 'htmlAndMathml',
    }),
  );
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -- KaTeX output of trusted, built TeX -->
<span class="math" class:display>{@html html}</span>

<style>
  .math {
    display: inline-block;
    max-width: 100%;
    line-height: 1;
    vertical-align: middle;
  }

  .display {
    display: block;
  }
</style>
