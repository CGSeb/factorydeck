import { join } from 'node:path';
import react from '@vitejs/plugin-react';
import type { InlineConfig } from 'vite';
import { HOST } from '../src/server/listen.ts';
import { UI_DIST_DIR } from '../src/server/paths.ts';

const UI_ROOT = join(import.meta.dirname, '..', 'src', 'ui');

/** Port of the Vite dev server. */
export const DEV_UI_PORT = 5173;

/** Vite configuration of the UI build. */
export function uiBuildConfig(): InlineConfig {
  return {
    configFile: false,
    root: UI_ROOT,
    plugins: [react()],
    build: { outDir: UI_DIST_DIR, emptyOutDir: true },
  };
}

/** Vite configuration of the dev server, proxying `/api` to the API on `apiPort`. */
export function uiDevConfig(apiPort: number): InlineConfig {
  return {
    ...uiBuildConfig(),
    server: {
      host: HOST,
      port: DEV_UI_PORT,
      strictPort: true,
      proxy: { '/api': `http://${HOST}:${apiPort}` },
    },
  };
}
