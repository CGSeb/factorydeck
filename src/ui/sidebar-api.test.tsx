// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReadyCounts } from '../sidebar/types.ts';
import { badgeText, linkName, linkTip } from './components/SidebarPanel.tsx';
import { sectionLinks } from './section-links.ts';
import {
  type LoadSidebar,
  readyOf,
  sidebarLoader,
  useReadyCounts,
} from './sidebar-api.ts';

describe('readyOf', () => {
  it('reads the ready counts of a sidebar answer', () => {
    expect(readyOf({ ready: { feature: 3, bug: 0 } })).toEqual({
      feature: 3,
      bug: 0,
    });
  });

  it.each([
    undefined,
    null,
    { status: 'unreachable', refreshSeconds: 10 },
    { ready: null },
    { ready: { feature: 3 } },
    { ready: { feature: '3', bug: 0 } },
    { ready: { feature: -1, bug: 0 } },
    { ready: { feature: 1.5, bug: 0 } },
  ])('rejects %j', (body) => {
    expect(readyOf(body)).toBeUndefined();
  });
});

describe('sidebarLoader', () => {
  function loaderAnswering(body: unknown, status = 200) {
    const fetchImpl = vi.fn<(url: string) => Promise<Response>>((_url) =>
      Promise.resolve(Response.json(body, { status })),
    );
    return {
      fetchImpl,
      load: sidebarLoader(fetchImpl as unknown as typeof fetch),
    };
  }

  it('asks every project without a project, and one project with it', async () => {
    const { fetchImpl, load } = loaderAnswering({
      ready: { feature: 1, bug: 2 },
    });
    expect(await load(undefined)).toEqual({ feature: 1, bug: 2 });
    expect(await load('/home/dev/example app')).toEqual({
      feature: 1,
      bug: 2,
    });
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      '/api/sidebar',
      '/api/sidebar?project=%2Fhome%2Fdev%2Fexample+app',
    ]);
  });

  it('gives nothing when the database does not answer', async () => {
    const { load } = loaderAnswering(
      { status: 'unreachable', refreshSeconds: 10 },
      503,
    );
    expect(await load(undefined)).toBeUndefined();
  });

  it('gives nothing when the request fails', async () => {
    const load = sidebarLoader(() => Promise.reject(new Error('offline')));
    expect(await load(undefined)).toBeUndefined();
  });
});

describe('badges', () => {
  const features = {
    label: 'Features',
    icon: 'features',
    href: '/features',
    current: false,
  } as const;

  it('shows the count up to 99, then 99+', () => {
    expect(badgeText(1)).toBe('1');
    expect(badgeText(99)).toBe('99');
    expect(badgeText(100)).toBe('99+');
  });

  it('names the link and its tooltip with the count', () => {
    const one = { ...features, badge: { count: 1, tone: 'neutral' } } as const;
    expect(linkName(one)).toBe('Features, 1 ready');
    expect(linkTip(one)).toBe('Features · 1 ready');
    const many = {
      ...features,
      badge: { count: 120, tone: 'neutral' },
    } as const;
    expect(linkName(many)).toBe('Features, 120 ready');
  });

  it('keeps the plain name without a badge or at 0', () => {
    expect(linkName(features)).toBe('Features');
    const zero = { ...features, badge: { count: 0, tone: 'neutral' } } as const;
    expect(linkName(zero)).toBe('Features');
    expect(linkTip(zero)).toBe('Features');
  });
});

describe('sectionLinks', () => {
  const ready: ReadyCounts = { feature: 4, bug: 2 };

  it('puts the ready features on Features and the ready bugs on Bugs', () => {
    const links = sectionLinks('/stats', '/work/app', true, ready);
    expect(
      links
        .filter((link) => link.badge !== undefined)
        .map(({ label, badge }) => [label, badge]),
    ).toEqual([
      ['Features', { count: 4, tone: 'neutral' }],
      ['Bugs', { count: 2, tone: 'danger' }],
    ]);
    expect(links.map((link) => link.href)).toContain(
      '/features?project=%2Fwork%2Fapp',
    );
  });

  it('leaves the bug count out with the Bugs link', () => {
    const links = sectionLinks('/', undefined, false, ready);
    expect(links.map((link) => link.label)).not.toContain('Bugs');
    expect(links.filter((link) => link.badge !== undefined)).toHaveLength(1);
  });

  it('shows no badge before the first counts', () => {
    const links = sectionLinks('/', undefined, true);
    expect(links.every((link) => link.badge === undefined)).toBe(true);
  });
});

describe('useReadyCounts', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  function setUp(first: string | undefined) {
    const answers = new Map<
      string,
      ((counts: ReadyCounts | undefined) => void)[]
    >();
    const load: LoadSidebar = (project) =>
      new Promise((resolve) => {
        const key = project ?? '';
        answers.set(key, [...(answers.get(key) ?? []), resolve]);
      });
    const hook = renderHook(
      ({
        project,
        version,
      }: {
        project: string | undefined;
        version: number;
      }) => useReadyCounts(load, project, 10, version),
      { initialProps: { project: first, version: 0 } },
    );
    async function answer(
      project: string | undefined,
      counts: ReadyCounts | undefined,
    ): Promise<void> {
      await act(async () => {
        answers.get(project ?? '')?.shift()?.(counts);
        await Promise.resolve();
      });
    }
    return { hook, answer, answers };
  }

  it('shows nothing before the first counts, nor when the database does not answer at first', async () => {
    const { hook, answer } = setUp(undefined);
    expect(hook.result.current).toBeUndefined();
    await answer(undefined, undefined);
    expect(hook.result.current).toBeUndefined();
  });

  it('keeps the last counts while another project loads', async () => {
    const { hook, answer } = setUp(undefined);
    await answer(undefined, { feature: 5, bug: 1 });
    hook.rerender({ project: '/work/app', version: 0 });
    expect(hook.result.current).toEqual({ feature: 5, bug: 1 });
    await answer('/work/app', { feature: 0, bug: 1 });
    expect(hook.result.current).toEqual({ feature: 0, bug: 1 });
  });

  it('ignores the answer of a project left before it arrived', async () => {
    const { hook, answer } = setUp('/work/app');
    hook.rerender({ project: '/work/lib', version: 0 });
    await answer('/work/lib', { feature: 2, bug: 0 });
    await answer('/work/app', { feature: 9, bug: 9 });
    expect(hook.result.current).toEqual({ feature: 2, bug: 0 });
  });

  it('keeps the last counts while the database does not answer', async () => {
    vi.useFakeTimers();
    const { hook, answer } = setUp(undefined);
    await answer(undefined, { feature: 3, bug: 2 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    await answer(undefined, undefined);
    expect(hook.result.current).toEqual({ feature: 3, bug: 2 });
  });

  it('refreshes on its own and after a collection', async () => {
    vi.useFakeTimers();
    const { hook, answer, answers } = setUp(undefined);
    await answer(undefined, { feature: 3, bug: 2 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    await answer(undefined, { feature: 2, bug: 2 });
    expect(hook.result.current).toEqual({ feature: 2, bug: 2 });
    hook.rerender({ project: undefined, version: 1 });
    expect(answers.get('')).toHaveLength(1);
    await answer(undefined, { feature: 1, bug: 0 });
    expect(hook.result.current).toEqual({ feature: 1, bug: 0 });
  });
});
