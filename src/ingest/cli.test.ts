import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const run = promisify(execFile);
const CLI = join(import.meta.dirname, 'cli.ts');

describe('pnpm ingest', () => {
  it('exits with code 1 when the sessions folder does not exist', async () => {
    const missing = join(import.meta.dirname, 'no-such-sessions-folder');
    const failure = await run(process.execPath, [CLI], {
      env: {
        ...process.env,
        CLAUDE_PROJECTS_DIR: missing,
        DATABASE_URL: 'postgres://nobody@127.0.0.1:1/none',
      },
    }).catch((error: unknown) => error);
    expect(failure).toMatchObject({
      code: 1,
      stderr: `Sessions folder not found: ${missing}\n`,
    });
  });
});
