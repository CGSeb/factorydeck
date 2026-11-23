import type {
  ContextPeaks,
  IssueFrictionRow,
  RoleFrictionRow,
} from '../frictions/types.ts';

export const APP = '/work/app';
export const LIB = '/work/lib';
export const BUILD_SESSION = '7f3a9c21-5b1e-4c8d-9a0f-123456789abc';

export const roleRows: RoleFrictionRow[] = [
  {
    role: 'builder',
    threads: 6,
    frictions: 26,
    perThread: 4.3,
    mainKind: 'tool-error',
  },
  {
    role: 'reviewer',
    threads: 4,
    frictions: 9,
    perThread: 2.3,
    mainKind: 'tool-error',
  },
  {
    role: 'main',
    threads: 5,
    frictions: 8,
    perThread: 1.6,
    mainKind: 'stop-blocked',
  },
  {
    role: 'unassigned',
    threads: 3,
    frictions: 4,
    perThread: 1.3,
    mainKind: 'compaction',
  },
  { role: 'shipper', threads: 2, frictions: 0, perThread: 0, mainKind: null },
];

const ISSUE_TITLES = [
  'Frictions page',
  'Read Codex sessions next to Claude Code sessions, with their own sub-agents and models',
  'Stats page',
  'Dark theme',
  'Sidebar navigation',
  'Work item marker',
  'Default roles',
  'Project names',
  'Labels',
  'Layout',
  'Controls',
  'Charts',
];

export const issueRows: IssueFrictionRow[] = ISSUE_TITLES.map(
  (title, index): IssueFrictionRow => ({
    project: index === 3 ? LIB : APP,
    projectName: index === 3 ? 'lib' : 'app',
    number: 41 - index,
    issue:
      index === 2
        ? { status: 'not-found' }
        : index === 3
          ? { status: 'not-collected' }
          : {
              status: 'found',
              title,
              url: `https://git.example/app/issues/${String(41 - index)}`,
            },
    stage:
      index === 0
        ? 'working'
        : index < 2
          ? 'in-review'
          : index < 4
            ? null
            : 'merged',
    frictions: Math.max(1, 12 - index * 2),
    repeated: index === 0 ? 2 : 0,
    compactions: index === 1 ? 2 : 0,
  }),
);

const PEAK_LABELS: [string, string | null, number][] = [
  ['Build the frictions page', 'Build #41', 182_000],
  ['Build the frictions page', 'Review #41', 96_000],
  ['Build the frictions page', null, 142_000],
  ['Stats page', 'Build #39', 151_000],
  ['Stats page', 'Review #39', 64_000],
  ['', null, 38_000],
  ['Dark theme', 'Rework #33', 120_500],
  ['Dark theme', null, 210_000],
];

export const contextPeaks: ContextPeaks = {
  threads: PEAK_LABELS.map(([sessionTitle, description, peak], index) => ({
    sessionId: index < 3 ? BUILD_SESSION : `session-${String(index)}-0000`,
    sessionTitle,
    sessionAgent: 'claude-code',
    description,
    peak,
  })),
  compacted: 3,
  medianPeak: 131_250,
  previous: { medianPeak: 150_000, threads: 9 },
};
