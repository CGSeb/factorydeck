import type { StateEvent } from '../git-host/types.ts';

export interface Version {
  number: number;
  startedAt: number;
  endedAt: number | null;
}

export interface VersionIssue {
  state: string;
  createdAt: Date;
  closedAt: Date | null;
  updatedAt: Date;
  stateEvents: readonly StateEvent[];
}

export interface VersionRequest {
  state: string;
  createdAt: Date;
  mergedAt: Date | null;
  updatedAt: Date;
}

const EVENT_ORDER: Record<StateEvent['state'], number> = {
  closed: 0,
  reopened: 1,
};

function inOrder(
  events: readonly StateEvent[],
): { state: StateEvent['state']; at: number }[] {
  return events
    .map((event) => ({ state: event.state, at: Date.parse(event.at) }))
    .filter((event) => !Number.isNaN(event.at))
    .sort(
      (left, right) =>
        left.at - right.at ||
        EVENT_ORDER[left.state] - EVENT_ORDER[right.state],
    );
}

export function versionsOf(issue: VersionIssue): Version[] {
  const versions: Version[] = [
    { number: 1, startedAt: issue.createdAt.getTime(), endedAt: null },
  ];
  for (const event of inOrder(issue.stateEvents)) {
    const current = versions.at(-1);
    if (current === undefined) break;
    const ongoing = current.endedAt === null;
    if (event.state === 'closed' && ongoing) current.endedAt = event.at;
    if (event.state === 'reopened' && !ongoing) {
      versions.push({
        number: current.number + 1,
        startedAt: event.at,
        endedAt: null,
      });
    }
  }
  const last = versions.at(-1);
  if (last !== undefined) {
    if (issue.state !== 'closed') last.endedAt = null;
    else {
      last.endedAt ??= (issue.closedAt ?? issue.updatedAt).getTime();
    }
  }
  return versions;
}

export function currentVersion(versions: readonly Version[]): Version {
  return versions.at(-1) ?? { number: 1, startedAt: 0, endedAt: null };
}

export function versionOfRequest(
  versions: readonly Version[],
  request: VersionRequest,
): number {
  const at = (
    request.state === 'merged'
      ? (request.mergedAt ?? request.updatedAt)
      : request.createdAt
  ).getTime();
  let found = 1;
  for (const version of versions) {
    if (version.startedAt <= at) found = version.number;
  }
  return found;
}
