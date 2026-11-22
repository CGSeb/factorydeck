import type { ProjectOption } from '../projects/label.ts';
import type { Period, TokenCounts } from '../overview/types.ts';

export const NO_SKILL_LABEL = 'No skill';

export interface SkillUsage {
  skill: string | null;
  launches: number;
  sessions: number;
  apiCalls: number;
  tokens: number;
  tokenCounts: TokenCounts;
  costUsd: number | null;
  averageCostUsd: number | null;
}

export interface SkillList {
  skills: SkillUsage[];
  launches: number;
  projects: ProjectOption[];
}

export interface SkillQuery {
  period: Period;
  timeZone: string;
  project?: string | undefined;
  now?: Date;
}

export interface LaunchPoint {
  day: string;
  launches: number;
}

export interface SkillSession {
  id: string;
  title: string;
  project: string;
  projectName: string;
  launches: number;
  tokens: number;
  tokenCounts: TokenCounts;
  costUsd: number | null;
}

export interface SkillDetail {
  skill: string;
  launches: number;
  tokens: number;
  tokenCounts: TokenCounts;
  costUsd: number | null;
  averageCostUsd: number | null;
  series: LaunchPoint[];
  sessions: SkillSession[];
  projects: ProjectOption[];
}

interface Refresh {
  updatedAt: string | null;
  refreshSeconds: number;
}

export type SkillListResponse =
  | ({ status: 'ok'; list: SkillList } & Refresh)
  | { status: 'unreachable'; refreshSeconds: number };

export type SkillResponse =
  | ({ status: 'ok'; skill: SkillDetail } & Refresh)
  | { status: 'unreachable'; refreshSeconds: number };
