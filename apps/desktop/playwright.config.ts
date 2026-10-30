import { defineConfig } from '@playwright/test';

// CI retries: Linux runners occasionally fail to spawn the freshly installed Electron binary (ETXTBSY).
export default defineConfig({ testDir: 'e2e', timeout: 60_000, outputDir: 'e2e/.results', retries: process.env.CI ? 2 : 0 });
