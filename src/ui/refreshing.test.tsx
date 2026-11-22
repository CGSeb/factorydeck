// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useRefreshing } from './skills-api.ts';

interface Response {
  refreshSeconds: number;
  value: string;
}

function deferred(): {
  promise: Promise<Response>;
  resolve: (value: string) => void;
} {
  let resolve: (value: string) => void = () => undefined;
  const promise = new Promise<Response>((done) => {
    resolve = (value) => done({ refreshSeconds: 3600, value });
  });
  return { promise, resolve };
}

function setUp(first: { key: string; scope: string }) {
  const loads = new Map<string, ReturnType<typeof deferred>>();
  const hook = renderHook(
    ({ key, scope }: { key: string; scope: string }) =>
      useRefreshing(
        key,
        () => {
          const load = deferred();
          loads.set(key, load);
          return load.promise;
        },
        scope,
      ),
    { initialProps: first },
  );
  async function settle(key: string, value: string): Promise<void> {
    await act(async () => {
      loads.get(key)?.resolve(value);
      await Promise.resolve();
    });
  }
  return { hook, settle };
}

describe('useRefreshing', () => {
  afterEach(cleanup);

  it('keeps the last data on screen while a new period loads in the same scope', async () => {
    const { hook, settle } = setUp({ key: '7d', scope: 'sessions' });
    await settle('7d', 'last week');
    hook.rerender({ key: '30d', scope: 'sessions' });
    expect(hook.result.current?.value).toBe('last week');
    await settle('30d', 'last month');
    expect(hook.result.current?.value).toBe('last month');
  });

  it('never shows the data of another scope', async () => {
    const { hook, settle } = setUp({ key: 'issue 1', scope: 'issue 1' });
    await settle('issue 1', 'first issue');
    hook.rerender({ key: 'issue 2', scope: 'issue 2' });
    expect(hook.result.current).toBeUndefined();
  });
});
