/**
 * Sidebar panel registry. A feature adds a panel by registering it here (or by calling
 * `registerPanel` from its own module) — the layout never needs to change.
 *
 * Each panel component receives the store as its only prop and should read the narrowest
 * state it needs (e.g. `store.doc.transforms[0].rows[i][j]`), so live edits only update the
 * parts of the UI that actually depend on the edited value.
 */
import type { Component } from 'svelte';
import type { SceneStore } from '../../state/store.types';
import type { IconName } from '../components/icons';
import AnalysisPanel from './analysis/AnalysisPanel.svelte';
import LayersPanel from './LayersPanel.svelte';
import MatrixPanel from './matrix/MatrixPanel.svelte';
import PresetsPanel from './PresetsPanel.svelte';
import SettingsPanel from './SettingsPanel.svelte';
import VectorsPanel from './vectors/VectorsPanel.svelte';

export interface PanelProps {
  store: SceneStore;
}

export interface PanelDef {
  readonly id: string;
  readonly title: string;
  readonly icon?: IconName;
  /** Ascending order in the sidebar. */
  readonly order: number;
  readonly defaultOpen: boolean;
  readonly component: Component<PanelProps>;
  /** Show the panel only when this returns true (reactive: may read store state). */
  when?(store: SceneStore): boolean;
}

const panels: PanelDef[] = [];

export function registerPanel(def: PanelDef): void {
  if (panels.some((p) => p.id === def.id)) throw new Error(`Panel '${def.id}' already registered`);
  panels.push(def);
  panels.sort((a, b) => a.order - b.order);
}

/** Registered panels in order (not filtered by `when`). */
export function allPanels(): readonly PanelDef[] {
  return panels;
}

registerPanel({
  id: 'matrix',
  title: 'Matrix',
  icon: 'matrix',
  order: 10,
  defaultOpen: true,
  component: MatrixPanel,
});
registerPanel({
  id: 'presets',
  title: 'Presets',
  icon: 'grid',
  order: 20,
  defaultOpen: true,
  component: PresetsPanel,
});
registerPanel({
  id: 'analysis',
  title: 'Analysis',
  icon: 'sigma',
  order: 30,
  defaultOpen: true,
  component: AnalysisPanel,
});
registerPanel({
  id: 'vectors',
  title: 'Vectors',
  icon: 'vector',
  order: 40,
  defaultOpen: true,
  component: VectorsPanel,
});
registerPanel({
  id: 'layers',
  title: 'Layers',
  icon: 'layers',
  order: 50,
  defaultOpen: false,
  component: LayersPanel,
});
registerPanel({
  id: 'settings',
  title: 'Settings',
  icon: 'sliders',
  order: 60,
  defaultOpen: false,
  component: SettingsPanel,
});
