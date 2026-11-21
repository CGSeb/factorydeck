import { join } from 'node:path';

/** Where `pnpm build` writes the UI and `pnpm start` serves it from. */
export const UI_DIST_DIR = join(import.meta.dirname, '..', '..', 'dist', 'ui');
