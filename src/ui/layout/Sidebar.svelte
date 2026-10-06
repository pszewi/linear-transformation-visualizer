<!-- Floating right sidebar (desktop). Collapses to a slim rail of panel icons. -->
<script lang="ts">
  import { tick } from 'svelte';
  import { fade } from 'svelte/transition';
  import type { SceneStore } from '../../state/store.types';
  import IconButton from '../components/IconButton.svelte';
  import { prefersReducedMotion } from '../lib/dom';
  import { prefs, savePrefs } from '../lib/prefs.svelte';
  import { allPanels, type PanelDef } from '../panels/registry';
  import PanelStack from './PanelStack.svelte';
  import ScrollArea from './ScrollArea.svelte';

  interface Props {
    store: SceneStore;
  }

  let { store }: Props = $props();

  let scroller = $state<HTMLDivElement>();
  const collapsed = $derived(prefs.sidebarCollapsed);
  const panels = $derived(allPanels().filter((p) => !p.when || p.when(store)));
  const duration = prefersReducedMotion() ? 0 : 160;

  function setCollapsed(value: boolean) {
    prefs.sidebarCollapsed = value;
    savePrefs();
  }

  async function reveal(panel: PanelDef) {
    prefs.panels[panel.id] = true;
    setCollapsed(false);
    await tick();
    const target = document.getElementById(`panel-${panel.id}`);
    target?.scrollIntoView({
      block: 'start',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
    target
      ?.querySelector<HTMLButtonElement>('button[aria-expanded]')
      ?.focus({ preventScroll: true });
  }
</script>

<aside class="sidebar glass" class:collapsed aria-label="Inspector" data-occludes="right">
  {#if collapsed}
    <div class="rail" in:fade={{ duration }}>
      <IconButton
        icon="panelRight"
        label="Expand sidebar"
        tooltip="left"
        onclick={() => setCollapsed(false)}
      />
      <span class="rule" aria-hidden="true"></span>
      {#each panels as panel (panel.id)}
        <IconButton
          icon={panel.icon ?? 'panelRight'}
          label={panel.title}
          tooltip="left"
          onclick={() => reveal(panel)}
        />
      {/each}
    </div>
  {:else}
    <div class="full" in:fade={{ duration }}>
      <header class="head">
        <span class="heading">Inspector</span>
        <IconButton
          icon="panelRight"
          label="Collapse sidebar"
          tooltip="left"
          size="sm"
          onclick={() => setCollapsed(true)}
        />
      </header>
      <ScrollArea bind:element={scroller} label="Panels">
        <div class="content"><PanelStack {store} /></div>
      </ScrollArea>
    </div>
  {/if}
</aside>

<style>
  .sidebar {
    position: fixed;
    z-index: var(--z-panels);
    top: var(--inset);
    right: var(--inset);
    bottom: var(--inset);
    display: flex;
    flex-direction: column;
    width: var(--sidebar-width);
    /* clip, not hidden: a hidden-overflow box can still be scrolled by focus(). */
    overflow: clip;
    border-radius: var(--radius-xl);
    transition:
      width var(--duration-slow) var(--ease-out),
      bottom var(--duration-slow) var(--ease-out);
  }

  .sidebar.collapsed {
    bottom: auto;
    width: var(--sidebar-rail-width);
  }

  .full {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    width: var(--sidebar-width);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-3) var(--space-2) var(--space-4);
  }

  .heading {
    color: var(--color-text-faint);
    font-size: var(--text-2xs);
    font-weight: var(--weight-semibold);
    letter-spacing: var(--tracking-caps);
    text-transform: uppercase;
  }

  .content {
    padding: 0 var(--space-2) var(--space-2);
  }

  .rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-2) 0;
  }

  .rule {
    width: 20px;
    height: 1px;
    margin: var(--space-1) 0;
    background: var(--color-border);
  }
</style>
