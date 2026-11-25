import type { IssueKind } from '../git-host/kind.ts';

export type ReadyCounts = Record<IssueKind, number>;

export interface SidebarData {
  ready: ReadyCounts;
}

export type SidebarResponse =
  SidebarData | { status: 'unreachable'; refreshSeconds: number };
