import { useEffect, useState } from 'react';
import type { SkillUsage } from '../skills/types.ts';
import type {
  SessionDetail,
  SessionResponse,
  SubAgentSummary,
} from '../sessions/types.ts';
import type { ChartSegment } from './components/chart-math.ts';
import { MISSING } from './format.ts';
import type { LoadSession } from './sessions-api.ts';

const RETRY_SECONDS = 10;

export function kindSegments(session: SessionDetail): ChartSegment[] {
  const { tokens } = session;
  return [
    {
      label: 'Cache read',
      value: tokens.cacheRead,
      color: 'var(--fd-kind-cache-read)',
    },
    {
      label: 'Cache write',
      value: tokens.cacheWrite,
      color: 'var(--fd-kind-cache-write)',
    },
    { label: 'Input', value: tokens.input, color: 'var(--fd-kind-input)' },
    { label: 'Output', value: tokens.output, color: 'var(--fd-kind-output)' },
  ];
}

export function byStart(subAgents: SubAgentSummary[]): SubAgentSummary[] {
  return subAgents
    .map((agent, index) => ({ agent, index }))
    .sort((a, b) => {
      const left = a.agent.firstAt;
      const right = b.agent.firstAt;
      if (left === right) return a.index - b.index;
      if (left === null) return 1;
      if (right === null) return -1;
      return Date.parse(left) - Date.parse(right) || a.index - b.index;
    })
    .map(({ agent }) => agent);
}

export function hasSkill(skills: SkillUsage[]): boolean {
  return skills.some((row) => row.skill !== null);
}

export function agentName(agent: SubAgentSummary): string {
  return agent.description || agent.agentType || MISSING;
}

export function useSession(
  loadSession: LoadSession,
  id: string,
): SessionResponse | undefined {
  const [loaded, setLoaded] = useState<{
    id: string;
    response: SessionResponse;
  }>();

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function refresh(): Promise<void> {
      const next = await loadSession(id);
      if (!active) return;
      if (next !== undefined) setLoaded({ id, response: next });
      timer = setTimeout(
        () => void refresh(),
        (next?.refreshSeconds ?? RETRY_SECONDS) * 1000,
      );
    }
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [loadSession, id]);

  return loaded?.id === id ? loaded.response : undefined;
}
