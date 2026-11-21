import { setTimeout as delay } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { startIngestLoop } from './ingest-loop.ts';

describe('startIngestLoop', () => {
  it('runs at start-up, then again after each interval', async () => {
    let runs = 0;
    const loop = startIngestLoop({
      run: () => {
        runs += 1;
        return Promise.resolve(true);
      },
      intervalMs: 40,
      onError: () => undefined,
    });
    expect(runs).toBe(1);
    await delay(150);
    await loop.stop();
    expect(runs).toBeGreaterThanOrEqual(3);
    expect(runs).toBeLessThanOrEqual(5);
  });

  it('never starts a run while the previous one is still going', async () => {
    let running = 0;
    let mostAtOnce = 0;
    let runs = 0;
    const loop = startIngestLoop({
      run: async () => {
        runs += 1;
        running += 1;
        mostAtOnce = Math.max(mostAtOnce, running);
        await delay(60);
        running -= 1;
        return true;
      },
      intervalMs: 5,
      onError: () => undefined,
    });
    await delay(200);
    await loop.stop();
    expect(runs).toBeGreaterThanOrEqual(2);
    expect(mostAtOnce).toBe(1);
  });

  it('keeps the time of the last finished ingestion', async () => {
    const results = [true, false];
    const loop = startIngestLoop({
      run: () => Promise.resolve(results.shift() ?? false),
      intervalMs: 10,
      onError: () => undefined,
    });
    expect(loop.lastFinishedAt()).toBeUndefined();
    await delay(5);
    const finished = loop.lastFinishedAt();
    expect(finished).toBeInstanceOf(Date);
    await delay(40);
    await loop.stop();
    expect(loop.lastFinishedAt()).toBe(finished);
  });

  it('reports a failed run and keeps retrying', async () => {
    const errors: unknown[] = [];
    let runs = 0;
    const loop = startIngestLoop({
      run: () => {
        runs += 1;
        return Promise.reject(new Error('Database unreachable'));
      },
      intervalMs: 10,
      onError: (error) => errors.push(error),
    });
    await delay(60);
    await loop.stop();
    expect(runs).toBeGreaterThanOrEqual(2);
    expect(errors).toHaveLength(runs);
    expect(loop.lastFinishedAt()).toBeUndefined();
  });
});
