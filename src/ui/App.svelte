<!--
  Composition root: boots the document (share link > autosave > default), creates the store and
  the engine, and wires store events → engine. Layout lives in ui/layout, panels in ui/panels.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { createEngine } from '../engine';
  import {
    browserStorage,
    createAutosave,
    documentFromHash,
    initialDocument,
    saveToStorage,
    SHARE_HASH_PREFIX,
    shareUrl,
  } from '../state/persistence';
  import { createStore } from '../state/store.svelte';
  import Toast from './components/Toast.svelte';
  import { showToast } from './components/toast.svelte';
  import BottomSheet from './layout/BottomSheet.svelte';
  import { handleShortcut } from './layout/shortcuts';
  import { trackViewInsets } from './lib/viewInsets';
  import ShortcutsDialog from './layout/ShortcutsDialog.svelte';
  import Sidebar from './layout/Sidebar.svelte';
  import Toolbar from './layout/Toolbar.svelte';
  import Viewport from './layout/Viewport.svelte';

  const NARROW_QUERY = '(max-width: 759px)';

  const storage = browserStorage();
  const boot = initialDocument(location.hash, storage);
  const store = createStore({ initial: boot.doc });
  const engine = createEngine();

  let host = $state<HTMLElement>();
  let helpOpen = $state(false);
  let narrow = $state(matchMedia(NARROW_QUERY).matches);

  /** Drop `#s=…` once loaded so a reload restores the autosave, not the original link. */
  function clearShareHash() {
    if (location.hash.startsWith(SHARE_HASH_PREFIX)) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  async function share() {
    const url = shareUrl(store.snapshot(), location.href);
    try {
      await navigator.clipboard.writeText(url);
      showToast('Share link copied to clipboard', 'success');
    } catch {
      showToast('Could not access the clipboard', 'error');
    }
  }

  function onkeydown(e: KeyboardEvent) {
    if (helpOpen) return;
    handleShortcut(e, {
      undo: () => store.undo(),
      redo: () => store.redo(),
      setDimension: (n) => store.setDimension(n),
      resetCamera: () => store.resetCamera(),
      showHelp: () => (helpOpen = true),
    });
  }

  onMount(() => {
    if (!host) throw new Error('viewport host missing');
    engine.mount(host);
    const doc = store.snapshot();
    engine.dispatch({ type: 'load', doc });
    engine.dispatch({ type: 'matrix', matrix: store.matrix, animate: false });
    engine.dispatch({ type: 'view', view: doc.view });
    engine.dispatch({ type: 'objects', objects: doc.objects });
    const unsubscribe = store.subscribe((event) => engine.dispatch(event));
    const stopInsets = host.parentElement
      ? trackViewInsets(host.parentElement, host, (insets) => engine.setViewInsets(insets))
      : () => {};

    const autosave = createAutosave(store, storage);
    const onPageHide = () => autosave.flush();
    addEventListener('pagehide', onPageHide);

    const onHashChange = () => {
      if (!location.hash.startsWith(SHARE_HASH_PREFIX)) return;
      const shared = documentFromHash(location.hash);
      clearShareHash();
      if (!shared) {
        showToast('That share link is invalid', 'error');
        return;
      }
      store.load(shared);
      saveToStorage(storage, store.snapshot());
      showToast('Loaded shared scene', 'success');
    };
    addEventListener('hashchange', onHashChange);

    const media = matchMedia(NARROW_QUERY);
    const onMedia = () => (narrow = media.matches);
    media.addEventListener('change', onMedia);

    // The hash is dropped below, so persist a linked scene now: otherwise a reload without edits
    // would show the older autosave (or the default) instead of what the link opened.
    if (boot.source === 'link') saveToStorage(storage, boot.doc);
    clearShareHash();
    if (boot.source === 'link') showToast('Loaded shared scene', 'success');
    else if (boot.invalidLink) showToast('That share link is invalid', 'error');

    return () => {
      unsubscribe();
      stopInsets();
      autosave.dispose();
      removeEventListener('pagehide', onPageHide);
      removeEventListener('hashchange', onHashChange);
      media.removeEventListener('change', onMedia);
      engine.dispose();
    };
  });
</script>

<svelte:window {onkeydown} />

<Viewport bind:host />
<Toolbar {store} {narrow} onshare={share} onhelp={() => (helpOpen = true)} />
{#if narrow}
  <BottomSheet {store} />
{:else}
  <Sidebar {store} />
{/if}
<ShortcutsDialog bind:open={helpOpen} />
<Toast />
