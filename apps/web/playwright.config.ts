import { defineConfig } from '@playwright/test';

const PORT = 4174;
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  outputDir: 'e2e/.results',
  use: { baseURL: `http://localhost:${PORT}/`, browserName: 'chromium' },
  webServer: { command: `pnpm exec vite preview --port ${PORT} --strictPort`, port: PORT, reuseExistingServer: false },
});
