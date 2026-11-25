import { useEffect, useState } from 'react';
import type { ReadyCounts } from '../sidebar/types.ts';
import { fetchJson } from './skills-api.ts';

export type LoadSidebar = (
  project: string | undefined,
) => Promise<ReadyCounts | undefined>;

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function readyOf(body: unknown): ReadyCounts | undefined {
  if (typeof body !== 'object' || body === null || !('ready' in body)) {
    return undefined;
  }
  const { ready } = body;
  if (typeof ready !== 'object' || ready === null) return undefined;
  const feature = 'feature' in ready ? ready.feature : undefined;
  const bug = 'bug' in ready ? ready.bug : undefined;
  return isCount(feature) && isCount(bug) ? { feature, bug } : undefined;
}

export function sidebarLoader(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): LoadSidebar {
  return async (project) => {
    const query = new URLSearchParams();
    if (project !== undefined) query.set('project', project);
    const search = query.toString();
    const body = await fetchJson(
      fetchImpl,
      search === '' ? '/api/sidebar' : `/api/sidebar?${search}`,
    );
    return readyOf(body);
  };
}

export function useReadyCounts(
  load: LoadSidebar | undefined,
  project: string | undefined,
  refreshSeconds: number,
  version: number,
): ReadyCounts | undefined {
  const [counts, setCounts] = useState<ReadyCounts>();
  useEffect(() => {
    if (load === undefined) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll(loader: LoadSidebar): Promise<void> {
      const next = await loader(project);
      if (!active) return;
      if (next !== undefined) setCounts(next);
      timer = setTimeout(() => void poll(loader), refreshSeconds * 1000);
    }
    void poll(load);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [load, project, refreshSeconds, version]);
  return counts;
}
