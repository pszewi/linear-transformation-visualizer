<!-- All registered panels (filtered by `when`) as collapsible sections. -->
<script lang="ts">
  import type { SceneStore } from '../../state/store.types';
  import Section from '../components/Section.svelte';
  import { prefs, savePrefs } from '../lib/prefs.svelte';
  import { allPanels, type PanelDef } from '../panels/registry';

  interface Props {
    store: SceneStore;
  }

  let { store }: Props = $props();

  const panels = $derived(allPanels().filter((p) => !p.when || p.when(store)));

  const isOpen = (p: PanelDef) => prefs.panels[p.id] ?? p.defaultOpen;

  function setOpen(p: PanelDef, open: boolean) {
    prefs.panels[p.id] = open;
    savePrefs();
  }
</script>

<div class="stack">
  {#each panels as panel (panel.id)}
    <Section
      id="panel-{panel.id}"
      title={panel.title}
      icon={panel.icon}
      open={isOpen(panel)}
      ontoggle={(open) => setOpen(panel, open)}
    >
      <panel.component {store} />
    </Section>
  {/each}
</div>

<style>
  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
</style>
