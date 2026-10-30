import { defineConfig } from '@playwright/test';

export default defineConfig({ testDir: '.', outputDir: '../e2e/.results/store' });
