import {
  AUTONOMY_MERGED,
  helpKind,
  mergeDaysAgo,
  mergedIssueNumber,
} from './autonomy.ts';
import { type Call, type DemoSession, haiku, sonnet } from './calls.ts';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const FLOW_SESSIONS = 20;
export const FLOW_OUTLIER = 10;
export const REWORKED = 4;
const MINUTE = 60_000;
const AFTER_REFUSAL_MINUTES = 27;
const AFTER_PASS_MINUTES = 12;

function repeated(call: Call, count: number): Call[] {
  return Array.from({ length: count }, () => call);
}

export function flowIndexes(): number[] {
  return Array.from(
    { length: FLOW_SESSIONS },
    (_, offset) => AUTONOMY_MERGED - 2 * (FLOW_SESSIONS - offset) + 1,
  );
}

export function flowSessions(project: string): DemoSession[] {
  return flowIndexes().map((index, offset) => {
    const number = String(mergedIssueNumber(index));
    const outlier = offset === FLOW_OUTLIER;
    return {
      id: `demo-flow-${number}`,
      folder: '-demo-example-app',
      project,
      gitBranch: 'main',
      startsAgo: mergeDaysAgo(index) * DAY + (6 + (offset % 5) * 3) * HOUR,
      prompt: 'Work through the queue',
      calls: repeated(sonnet, outlier ? 2 : 1),
      subAgents: [
        {
          id: 'builder',
          agentType: 'general-purpose',
          description: `Build #${number}`,
          calls: repeated(sonnet, outlier ? 22 : 2),
        },
        {
          id: 'reviewer',
          agentType: 'general-purpose',
          description: `Review #${number}`,
          calls: repeated(haiku, outlier ? 8 : 1),
        },
      ],
    };
  });
}

function refusedFirst(index: number): boolean {
  const kind = helpKind(index);
  return kind === 'below' || kind === 'gates' || kind === 'spec-below';
}

export function reworkIndexes(): { refused: number[]; passed: number } {
  const [first, ...rest] = flowIndexes();
  const outlier = flowIndexes()[FLOW_OUTLIER];
  const candidates = rest.filter(
    (index) => index !== outlier && index !== first,
  );
  return {
    refused: candidates.filter(refusedFirst).slice(0, REWORKED),
    passed: candidates.find((index) => !refusedFirst(index)) ?? 0,
  };
}

function lateSession(
  project: string,
  index: number,
  minutesBeforeMerge: number,
): DemoSession {
  const number = String(mergedIssueNumber(index));
  return {
    id: `demo-flow-${number}-late`,
    folder: '-demo-example-app',
    project,
    gitBranch: 'main',
    startsAgo: mergeDaysAgo(index) * DAY + minutesBeforeMerge * MINUTE,
    prompt: 'Address the review',
    calls: [],
    subAgents: [
      {
        id: 'builder',
        agentType: 'general-purpose',
        description: `Build #${number}`,
        calls: [haiku, haiku],
      },
    ],
  };
}

export function reworkSessions(project: string): DemoSession[] {
  const { refused, passed } = reworkIndexes();
  return [
    ...refused.map((index) =>
      lateSession(project, index, AFTER_REFUSAL_MINUTES),
    ),
    lateSession(project, passed, AFTER_PASS_MINUTES),
  ];
}
