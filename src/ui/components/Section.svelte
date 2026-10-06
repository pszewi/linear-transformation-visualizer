<!--
  Collapsible card section. Content is unmounted while collapsed, so closed panels cost
  nothing during live edits.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { slide } from 'svelte/transition';
  import { prefersReducedMotion, uid } from '../lib/dom';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';

  interface Props {
    title: string;
    icon?: IconName;
    open?: boolean;
    ontoggle?: (open: boolean) => void;
    /** Small trailing text in the header (e.g. a count). */
    meta?: string;
    /** Header controls shown to the right (kept outside the toggle button). */
    actions?: Snippet;
    children: Snippet;
    id?: string;
  }

  let {
    title,
    icon,
    open = $bindable(true),
    ontoggle,
    meta,
    actions,
    children,
    id = uid('section'),
  }: Props = $props();

  const bodyId = $derived(`${id}-body`);
  const duration = prefersReducedMotion() ? 0 : 220;

  function toggle() {
    open = !open;
    ontoggle?.(open);
  }
</script>

<section class="section" class:open {id} aria-labelledby="{id}-title">
  <header>
    <button
      class="toggle"
      type="button"
      aria-expanded={open}
      aria-controls={bodyId}
      onclick={toggle}
    >
      <span class="chevron" aria-hidden="true"><Icon name="chevronDown" size={14} /></span>
      {#if icon}<span class="icon"><Icon name={icon} size={15} /></span>{/if}
      <span class="title" id="{id}-title">{title}</span>
      {#if meta}<span class="meta num">{meta}</span>{/if}
    </button>
    {#if actions}<div class="actions">{@render actions()}</div>{/if}
  </header>
  {#if open}
    <div class="body" id={bodyId} transition:slide={{ duration, easing: cubicOut }}>
      <div class="inner">{@render children()}</div>
    </div>
  {/if}
</section>

<style>
  .section {
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-lg);
    background: var(--color-surface-1);
    box-shadow: var(--shadow-inset-top);
  }

  header {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-height: 44px;
    padding: 0 var(--space-2) 0 var(--space-1);
  }

  .toggle {
    display: flex;
    flex: 1;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    height: 36px;
    padding: 0 var(--space-2);
    border-radius: var(--radius-md);
    color: var(--color-text);
    text-align: left;
    transition: background-color var(--duration-fast) var(--ease-out);
  }

  .toggle:hover {
    background: var(--color-overlay-hover);
  }

  .chevron {
    display: grid;
    place-items: center;
    color: var(--color-text-faint);
    transform: rotate(-90deg);
    transition:
      transform var(--duration-base) var(--ease-out),
      color var(--duration-fast) var(--ease-out);
  }

  .open .chevron {
    transform: rotate(0deg);
  }

  .toggle:hover .chevron {
    color: var(--color-text-muted);
  }

  .icon {
    display: grid;
    place-items: center;
    color: var(--color-text-muted);
  }

  .title {
    overflow: hidden;
    font-size: var(--text-md);
    font-weight: var(--weight-semibold);
    letter-spacing: -0.005em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta {
    margin-left: auto;
    padding: 1px var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--color-surface-2);
    color: var(--color-text-muted);
    font-size: var(--text-2xs);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .inner {
    padding: var(--space-1) var(--space-4) var(--space-4);
  }
</style>
