/**
 * Vitest environment for testing `.svelte.ts` modules: plain Node globals, but modules are
 * transformed by Vite's *client* environment, so Svelte compiles runes in client mode
 * (real signals, memoised `$derived`, deep `$state` proxies) — the same code the browser runs.
 */
import type { Environment } from 'vitest/runtime';

const env: Environment = {
  name: 'svelte-client',
  viteEnvironment: 'client',
  setup() {
    return { teardown() {} };
  },
};

export default env;
