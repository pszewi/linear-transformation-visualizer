import { mount } from 'svelte';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import 'katex/dist/katex.min.css';
import './styles/tokens.css';
import './styles/base.css';
import App from './ui/App.svelte';
// Registers the built-in decompositions (polar) with the core registry.
import './core/linalg/decompositions';

const target = document.getElementById('app');
if (!target) throw new Error('#app not found');

async function start(el: HTMLElement) {
  // Dev-only gallery of analysis fixtures (complex, defective, non-square, …): /?fixtures
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('fixtures')) {
    const { default: Gallery } = await import('./ui/dev/FixtureGallery.svelte');
    return mount(Gallery, { target: el });
  }
  return mount(App, { target: el });
}

export default start(target);
