import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    /** Database test files each create and migrate a scratch database in their hooks, all at once: a loaded CI runner needs more than the default 10 s. */
    hookTimeout: 30_000,
  },
});
