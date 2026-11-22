import type { ProjectOption } from '../projects/label.ts';
import type { Period, TokenCounts } from '../overview/types.ts';

export const UNASSIGNED_ROLE = 'unassigned';

export interface RoleUsage {
  role: string;
  threads: number;
  apiCalls: number;
  tokens: number;
  tokenCounts: TokenCounts;
  costUsd: number | null;
}

export interface RoleList {
  roles: RoleUsage[];
  apiCalls: number;
  projects: ProjectOption[];
}

export interface RoleQuery {
  period: Period;
  timeZone: string;
  project?: string | undefined;
  now?: Date;
}

export interface RoleSourceFile {
  path: string;
  exists: boolean;
}

export type RoleListResponse =
  | {
      status: 'ok';
      list: RoleList;
      config: RoleSourceFile;
      updatedAt: string | null;
      refreshSeconds: number;
    }
  | { status: 'unreachable'; refreshSeconds: number };
