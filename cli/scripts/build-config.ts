import { join } from 'node:path';
import type { InlineConfig } from 'vite';

export const CLI_ROOT = join(import.meta.dirname, '..');
export const CLI_DIST_DIR = join(CLI_ROOT, 'dist');
export const NODE_TARGET = 'node22';

export function cliBuildConfig(): InlineConfig {
  return {
    configFile: false,
    root: CLI_ROOT,
    logLevel: 'warn',
    ssr: { noExternal: true, target: 'node' },
    build: {
      ssr: true,
      target: NODE_TARGET,
      outDir: CLI_DIST_DIR,
      emptyOutDir: true,
      sourcemap: false,
      minify: false,
      copyPublicDir: false,
      lib: {
        entry: join(CLI_ROOT, 'src', 'main.ts'),
        formats: ['es'],
        fileName: () => 'main.js',
      },
    },
  };
}
