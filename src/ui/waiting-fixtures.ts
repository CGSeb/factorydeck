import type {
  WaitReason,
  WaitingIssue,
  WaitingList,
  WaitingResponse,
} from '../stats/types.ts';
import { APP, LIB } from './feature-fixtures.ts';
import { nameOf, optionsOf } from './project-fixtures.ts';
import type { LoadWaiting } from './stats-api.ts';

export const WAITING_NOW = new Date('2026-11-24T15:00:00Z');

const HOUR = 3_600_000;

function waitingIssue(
  [number, title]: readonly [number, string],
  reasons: WaitReason[],
  hoursAgo: number | null,
  project = APP,
): WaitingIssue {
  return {
    project,
    projectName: nameOf(project),
    number,
    title,
    kind: 'feature',
    reasons,
    since:
      hoursAgo === null
        ? null
        : new Date(WAITING_NOW.getTime() - hoursAgo * HOUR).toISOString(),
  };
}

const PROJECTS = optionsOf([APP, LIB]);

export const someWaiting: WaitingList = {
  issues: [
    {
      ...waitingIssue([58, 'Retry failed exports'], ['below-threshold'], 28),
      score: 48,
    },
    waitingIssue(
      [63, 'Audit log filters'],
      ['blocked', 'spec-question'],
      3 + 5 / 60,
      LIB,
    ),
    waitingIssue([66, 'Webhook signatures'], ['gates-failed'], 0.5),
    waitingIssue([71, 'Rate limit per token'], ['blocked'], null, LIB),
    waitingIssue([69, 'Bulk tag edit'], ['spec-question'], null),
  ],
  projects: PROJECTS,
};

export const manyWaiting: WaitingList = {
  issues: Array.from({ length: 13 }, (_, index) =>
    waitingIssue(
      [80 + index, `Waiting issue ${String(index + 1)}`],
      ['spec-question'],
      40 - index,
    ),
  ),
  projects: PROJECTS,
};

export const noWaiting: WaitingList = { issues: [], projects: PROJECTS };

export function waitingResponse(waiting: WaitingList): WaitingResponse {
  return {
    status: 'ok',
    updatedAt: '2026-11-24T15:00:00.000Z',
    refreshSeconds: 3600,
    waiting,
  };
}

export function waitingLoaderOf(
  waiting: WaitingList = someWaiting,
): LoadWaiting {
  return (project) =>
    Promise.resolve(
      waitingResponse({
        ...waiting,
        issues: waiting.issues.filter(
          (issue) => project === undefined || issue.project === project,
        ),
      }),
    );
}

export const unreachableWaiting: LoadWaiting = () =>
  Promise.resolve({ status: 'unreachable', refreshSeconds: 3600 });

export const pendingWaiting: LoadWaiting = () => new Promise(() => undefined);
