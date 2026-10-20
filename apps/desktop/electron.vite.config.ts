import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

const WORKSPACE = ['@retarget3mf/core', '@retarget3mf/profiles', '@retarget3mf/bridge'];

export default defineConfig({
  // Workspace packages ship TypeScript sources, so they are bundled rather than required at runtime.
  main: {
    build: {
      externalizeDeps: { exclude: WORKSPACE },
      // host.js is the native messaging host the browser starts with plain Node; see src/host.
      rollupOptions: { input: { index: resolve(import.meta.dirname, 'src/main/index.ts'), host: resolve(import.meta.dirname, 'src/host/index.ts') } },
    },
  },
  // Sandboxed preloads must be a single CommonJS file.
  preload: {
    build: {
      externalizeDeps: false,
      rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } },
    },
  },
  renderer: { plugins: [react()] },
});
