import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import svelteConfig from './svelte.config.js';

/**
 * Dependency direction (see docs/ARCHITECTURE.md):
 *   ui ──▶ state ──▶ core        engine ──▶ core, state (types/catalogs only)
 * core is pure: no DOM, three, svelte or app-layer imports.
 */
const restrict = (patterns) => ({
  'no-restricted-imports': ['error', { patterns }],
});

export default ts.config(
  {
    ignores: [
      'dist/',
      'node_modules/',
      'test-results/',
      'playwright-report/',
      '.claude/',
      'src-tauri/',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.svelte'],
        parser: ts.parser,
        svelteConfig,
      },
    },
  },
  {
    files: ['src/core/**'],
    rules: restrict([
      {
        group: ['three', 'three/*', 'svelte', 'svelte/*', 'katex'],
        message: 'core/ must stay pure.',
      },
      {
        group: ['**/state/**', '**/engine/**', '**/ui/**', '**/theme/**'],
        message: 'core/ must not depend on app layers.',
      },
    ]),
  },
  {
    files: ['src/state/**'],
    rules: restrict([
      { group: ['three', 'three/*'], message: 'state/ must not touch three.js.' },
      { group: ['**/engine/**', '**/ui/**'], message: 'state/ must not depend on engine/ or ui/.' },
    ]),
  },
  {
    files: ['src/engine/**'],
    rules: restrict([
      { group: ['svelte', 'svelte/*', '**/*.svelte'], message: 'engine/ is framework-free.' },
      { group: ['**/ui/**'], message: 'engine/ must not depend on ui/.' },
    ]),
  },
  {
    files: ['src/ui/**'],
    rules: restrict([
      {
        group: ['three', 'three/*'],
        message: 'ui/ never touches three.js; go through the engine handle.',
      },
      {
        group: ['**/engine/*/**'],
        message: 'ui/ may only import the engine public entry (engine/index.ts).',
      },
    ]),
  },
);
