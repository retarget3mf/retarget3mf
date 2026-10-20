import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

const WORKSPACE = ['@retarget3mf/core', '@retarget3mf/profiles'];

export default defineConfig({
  // Workspace packages ship TypeScript sources, so they are bundled rather than required at runtime.
  main: { build: { externalizeDeps: { exclude: WORKSPACE } } },
  // Sandboxed preloads must be a single CommonJS file.
  preload: {
    build: {
      externalizeDeps: false,
      rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } },
    },
  },
  renderer: { plugins: [react()] },
});
