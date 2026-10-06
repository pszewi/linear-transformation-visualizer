<!-- Toast region: renders the queue from toast.svelte.ts in a polite live region. -->
<script lang="ts">
  import { flip } from 'svelte/animate';
  import { fly, fade } from 'svelte/transition';
  import { prefersReducedMotion } from '../lib/dom';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';
  import { dismissToast, toasts, type ToastTone } from './toast.svelte';

  const icons: Record<ToastTone, IconName> = { info: 'info', success: 'check', error: 'alert' };
  const reduced = prefersReducedMotion();
</script>

<div class="region" role="status" aria-live="polite">
  {#each toasts.items as toast (toast.id)}
    <div
      class="toast"
      data-tone={toast.tone}
      animate:flip={{ duration: reduced ? 0 : 200 }}
      in:fly={{ y: 12, duration: reduced ? 0 : 220 }}
      out:fade={{ duration: reduced ? 0 : 160 }}
    >
      <span class="icon"><Icon name={icons[toast.tone]} size={15} /></span>
      <span class="message">{toast.message}</span>
      <button
        class="close"
        type="button"
        aria-label="Dismiss notification"
        onclick={() => dismissToast(toast.id)}
      >
        <Icon name="close" size={13} />
      </button>
    </div>
  {/each}
</div>

<style>
  .region {
    position: fixed;
    z-index: var(--z-toast);
    bottom: calc(var(--inset) + var(--space-4));
    left: 50%;
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    gap: var(--space-2);
    width: max-content;
    max-width: calc(100vw - 2 * var(--inset));
    transform: translateX(-50%);
    pointer-events: none;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    max-width: 100%;
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-pill);
    background: var(--color-surface-3);
    box-shadow: var(--shadow-lg);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    pointer-events: auto;
  }

  .icon {
    display: grid;
    place-items: center;
    color: var(--color-text-muted);
  }

  [data-tone='success'] .icon {
    color: var(--color-positive);
  }

  [data-tone='error'] .icon {
    color: var(--color-negative);
  }

  .message {
    min-width: 0;
  }

  .close {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    color: var(--color-text-faint);
    transition:
      background-color var(--duration-fast) var(--ease-out),
      color var(--duration-fast) var(--ease-out);
  }

  .close:hover {
    background: var(--color-overlay-active);
    color: var(--color-text);
  }
</style>
