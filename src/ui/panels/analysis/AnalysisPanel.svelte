<script lang="ts">
  import type { SceneStore } from '../../../state/store.types';
  import AnalysisView from './AnalysisView.svelte';

  interface Props {
    store: SceneStore;
  }

  let { store }: Props = $props();
</script>

<AnalysisView analysis={store.analysis} />
