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
    environment: 'node',
  },
});
