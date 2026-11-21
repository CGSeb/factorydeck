import { setTimeout as delay } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { startCollectLoop } from './collect-loop.ts';

describe('startCollectLoop', () => {
  it('runs at start-up, then again after each interval', async () => {
    let runs = 0;
    const loop = startCollectLoop({
      run: () => {
        runs += 1;
        return Promise.resolve();
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

  it('joins the running collection instead of starting another', async () => {
    let runs = 0;
    let finish: () => void = () => undefined;
    const loop = startCollectLoop({
      run: () => {
        runs += 1;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
      intervalMs: 60_000,
      onError: () => undefined,
    });
    let joined = false;
    const refresh = loop.refresh().then(() => {
      joined = true;
    });
    await delay(10);
    expect(runs).toBe(1);
    expect(joined).toBe(false);
    finish();
    await refresh;
    expect(joined).toBe(true);
    const next = loop.refresh();
    expect(runs).toBe(2);
    finish();
    await next;
    await loop.stop();
  });

  it('reports a failed run and keeps going', async () => {
    const errors: unknown[] = [];
    let runs = 0;
    const loop = startCollectLoop({
      run: () => {
        runs += 1;
        return Promise.reject(new Error('boom'));
      },
      intervalMs: 20,
      onError: (error) => errors.push(error),
    });
    await delay(70);
    await loop.stop();
    expect(runs).toBeGreaterThanOrEqual(2);
    expect(errors.length).toBe(runs);
  });
});
