<!--
  Composition root: boots the document (share link > autosave > default), creates the store and
  the engine, and wires store events → engine. Layout lives in ui/layout, panels in ui/panels.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { createEngine } from '../engine';
  import {
    openSceneFile,
    saveSceneFile,
    setWindowTitle,
    type SceneFileRef,
  } from '../platform/files';
  import { installAppMenu } from '../platform/menu';
  import {
    browserStorage,
    createAutosave,
    initialDocument,
    parseSceneFile,
    saveToStorage,
    serializeScene,
  } from '../state/persistence';
  import { createStore } from '../state/store.svelte';
  import Toast from './components/Toast.svelte';
  import { showToast } from './components/toastStore.svelte';
  import BottomSheet from './layout/BottomSheet.svelte';
  import { handleShortcut } from './layout/shortcuts';
  import { trackViewInsets } from './lib/viewInsets';
  import ShortcutsDialog from './layout/ShortcutsDialog.svelte';
  import Sidebar from './layout/Sidebar.svelte';
  import Toolbar from './layout/Toolbar.svelte';
  import Viewport from './layout/Viewport.svelte';

  const NARROW_QUERY = '(max-width: 759px)';

  const storage = browserStorage();
  const boot = initialDocument(storage);
  const store = createStore({ initial: boot.doc });
  const engine = createEngine();

  let host = $state<HTMLElement>();
  let helpOpen = $state(false);
  let narrow = $state(matchMedia(NARROW_QUERY).matches);

  /** The scene file this session last opened or saved; null until then ("Untitled"). */
  let file = $state<SceneFileRef | null>(null);
  /** Unsaved changes since the last open/save. */
  let dirty = $state(false);

  $effect(() => {
    const name = file?.name ?? 'Untitled';
    void setWindowTitle(`${dirty ? '• ' : ''}${name} — Linear Transformation Visualizer`);
  });

  function failed(action: string, err: unknown) {
    console.error(err);
    showToast(`Could not ${action} the scene file`, 'error');
  }

  async function openScene() {
    try {
      const picked = await openSceneFile();
      if (!picked) return;
      const doc = parseSceneFile(picked.text);
      if (!doc) {
        showToast(`${picked.file.name} is not a valid scene file`, 'error');
        return;
      }
      store.load(doc);
      saveToStorage(storage, store.snapshot());
      file = picked.file;
      dirty = false;
      showToast(`Opened ${picked.file.name}`, 'success');
    } catch (err) {
      failed('open', err);
    }
  }

  async function saveScene(saveAs = false) {
    try {
      const saved = await saveSceneFile(serializeScene(store.snapshot()), file, saveAs);
      if (!saved) return;
      file = saved;
      dirty = false;
      showToast(`Saved ${saved.name}`, 'success');
    } catch (err) {
      failed('save', err);
    }
  }

  const actions = {
    open: () => void openScene(),
    save: () => void saveScene(false),
    saveAs: () => void saveScene(true),
    undo: () => store.undo(),
    redo: () => store.redo(),
    setDimension: (n: 2 | 3) => store.setDimension(n),
    resetCamera: () => store.resetCamera(),
    showHelp: () => (helpOpen = true),
  };

  function onkeydown(e: KeyboardEvent) {
    if (helpOpen) return;
    handleShortcut(e, actions);
  }

  onMount(() => {
    if (!host) throw new Error('viewport host missing');
    engine.mount(host);
    const doc = store.snapshot();
    engine.dispatch({ type: 'load', doc });
    engine.dispatch({ type: 'matrix', matrix: store.matrix, animate: false });
    engine.dispatch({ type: 'view', view: doc.view });
    engine.dispatch({ type: 'objects', objects: doc.objects });
    const unsubscribe = store.subscribe((event) => {
      engine.dispatch(event);
      if (event.type !== 'view' && event.type !== 'resetCamera') dirty = true;
    });
    void installAppMenu(actions);
    const stopInsets = host.parentElement
      ? trackViewInsets(host.parentElement, host, (insets) => engine.setViewInsets(insets))
      : () => {};

    const autosave = createAutosave(store, storage);
    const onPageHide = () => autosave.flush();
    addEventListener('pagehide', onPageHide);

    const media = matchMedia(NARROW_QUERY);
    const onMedia = () => (narrow = media.matches);
    media.addEventListener('change', onMedia);

    return () => {
      unsubscribe();
      stopInsets();
      autosave.dispose();
      removeEventListener('pagehide', onPageHide);
      media.removeEventListener('change', onMedia);
      engine.dispose();
    };
  });
</script>

<svelte:window {onkeydown} />

<Viewport bind:host />
<Toolbar {store} {narrow} onopen={actions.open} onsave={actions.save} onhelp={actions.showHelp} />
{#if narrow}
  <BottomSheet {store} />
{:else}
  <Sidebar {store} />
{/if}
<ShortcutsDialog bind:open={helpOpen} />
<Toast />
