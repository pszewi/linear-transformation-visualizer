/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    include: ['tests/core/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    // Node globals, but Svelte runes compiled in client mode (see the file for why).
    environment: './tests/svelte-client-env.ts',
  },
});
