import { describe, expect, it } from 'vitest';
import { createDatabase } from './client.ts';

describe('createDatabase', () => {
  it('survives an idle client losing its connection', async () => {
    const { pool, close } = createDatabase(
      'postgres://user:secret@127.0.0.1:1/factorydeck',
    );
    expect(() =>
      pool.emit('error', new Error('Connection terminated unexpectedly')),
    ).not.toThrow();
    await close();
  });
});
