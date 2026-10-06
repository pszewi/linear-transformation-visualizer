import { defineConfig, devices } from '@playwright/test';

// Uses the preinstalled Chromium (PLAYWRIGHT_BROWSERS_PATH); @playwright/test is pinned to match it.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  // Perf/leak numbers are only meaningful without other tests competing for the (software) GPU.
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      // Headless Chromium has no GPU: opt in to SwiftShader WebGL explicitly (this also silences
      // the "automatic fallback to software WebGL" deprecation warning).
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: 'npx vite build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
