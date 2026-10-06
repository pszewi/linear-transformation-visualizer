<!-- Modal list of keyboard shortcuts (native <dialog>: focus trap + Esc for free). -->
<script lang="ts">
  import IconButton from '../components/IconButton.svelte';
  import Kbd from '../components/Kbd.svelte';
  import { SHORTCUT_GROUPS } from './shortcuts';

  interface Props {
    open: boolean;
  }

  let { open = $bindable() }: Props = $props();
  let dialog: HTMLDialogElement;

  $effect(() => {
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });

  function onclick(e: MouseEvent) {
    // Click on the backdrop (outside the panel) closes.
    if (e.target === dialog) open = false;
  }
</script>

<dialog
  bind:this={dialog}
  aria-labelledby="shortcuts-title"
  onclose={() => (open = false)}
  {onclick}
>
  <div class="panel">
    <header>
      <h2 id="shortcuts-title">Keyboard shortcuts</h2>
      <IconButton icon="close" label="Close" tooltip="none" onclick={() => (open = false)} />
    </header>
    {#each SHORTCUT_GROUPS as group (group.title)}
      <section>
        <h3>{group.title}</h3>
        <dl>
          {#each group.items as item (item.label)}
            <div class="item">
              <dt>{item.label}</dt>
              <dd><Kbd keys={item.keys} size="md" /></dd>
            </div>
          {/each}
        </dl>
      </section>
    {/each}
  </div>
</dialog>

<style>
  dialog {
    width: min(440px, calc(100vw - 2 * var(--inset)));
    max-height: calc(100vh - 4 * var(--inset));
    margin: auto;
    padding: 0;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-xl);
    background: var(--color-surface-1);
    box-shadow: var(--shadow-lg);
    color: var(--color-text);
  }

  dialog[open] {
    animation: dialog-in var(--duration-slow) var(--ease-out);
  }

  dialog::backdrop {
    background: var(--color-scrim);
    backdrop-filter: blur(2px);
  }

  .panel {
    padding: var(--space-4) var(--space-5) var(--space-5);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-2);
  }

  h2 {
    font-size: var(--text-lg);
    font-weight: var(--weight-semibold);
  }

  section + section {
    margin-top: var(--space-4);
  }

  h3 {
    margin-bottom: var(--space-1);
    color: var(--color-text-faint);
    font-size: var(--text-2xs);
    font-weight: var(--weight-semibold);
    letter-spacing: var(--tracking-caps);
    text-transform: uppercase;
  }

  .item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--color-border-subtle);
  }

  .item:last-child {
    border-bottom: none;
  }

  dt {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  @keyframes dialog-in {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.98);
    }
  }
</style>
