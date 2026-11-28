import type {
  FrictionOccurrence,
  OccurrencesResponse,
} from '../frictions/occurrence-types.ts';
import type { LoadOccurrences, LoadOutput } from './occurrences-api.ts';

const BUILD_SESSION = '7f3a9c21-5b1e-4c8d-9a0f-123456789abc';
const MAIN_SESSION = '0a1b2c3d-4e5f-4a6b-8c7d-0123456789ef';

export const LONG_ERROR = `Error: Cannot find module '~/work/app/src/${'deeply/nested/'.repeat(12)}missing.ts' imported from ~/work/app/src/index.ts`;

export const toolOccurrences: FrictionOccurrence[] = [
  {
    id: 101,
    at: '2026-11-22T17:33:00Z',
    role: 'builder',
    project: '/work/app',
    workItem: 41,
    sessionId: BUILD_SESSION,
    sessionTitle: 'Build the frictions page',
    exitCode: 1,
    hasMore: false,
    details: 'local',
    texts: {
      kind: 'tool-error',
      input: 'cd ~/work/app && git push origin feat/41-frictions',
      error:
        '! [rejected] feat/41-frictions -> feat/41-frictions (non-fast-forward)\nerror: failed to push some refs\nhint: Updates were rejected because the tip of your branch is behind',
      shell: true,
    },
  },
  {
    id: 102,
    at: '2026-11-22T11:05:00Z',
    role: 'reviewer',
    project: '/work/app',
    workItem: 41,
    sessionId: BUILD_SESSION,
    sessionTitle: 'Build the frictions page',
    exitCode: 128,
    hasMore: false,
    details: 'local',
    texts: {
      kind: 'tool-error',
      input: `git commit -m "${'a long commit subject '.repeat(6)}"`,
      error: LONG_ERROR,
      shell: true,
    },
  },
  {
    id: 103,
    at: '2026-11-21T09:05:00Z',
    role: 'main',
    project: '/work/app',
    workItem: null,
    sessionId: MAIN_SESSION,
    sessionTitle: '',
    exitCode: 1,
    hasMore: false,
    details: 'gone',
    texts: null,
  },
];

export const hookOccurrences: FrictionOccurrence[] = [
  {
    id: 201,
    at: '2026-11-20T11:00:00Z',
    role: 'builder',
    project: '/work/app',
    workItem: 41,
    sessionId: BUILD_SESSION,
    sessionTitle: 'Build the frictions page',
    exitCode: null,
    hasMore: false,
    details: 'local',
    texts: {
      kind: 'stop-blocked',
      message: 'pnpm check failed: 2 type errors\nRun pnpm typecheck',
    },
  },
];

export const TAIL_ERROR = [
  "src/ui/Page.tsx(40,3): error TS2304: Cannot find name 'useRefresh'.",
  'Found 2 errors in 2 files.',
  'Errors  Files',
  '     1  src/ui/App.tsx:12',
  '     1  src/ui/Page.tsx:40',
].join('\n');

export const HEAD_ERROR =
  'File has not been read yet. Read it first before writing to it.\nThe file was changed on disk since it was last read.\nRead it again.';

export const errorOccurrences: FrictionOccurrence[] = [
  {
    id: 301,
    at: '2026-11-23T15:42:00Z',
    role: 'builder',
    project: '/work/app',
    workItem: 41,
    sessionId: BUILD_SESSION,
    sessionTitle: 'Build the frictions page',
    exitCode: 2,
    hasMore: true,
    details: 'local',
    texts: {
      kind: 'tool-error',
      input: 'pnpm format; pnpm lint && pnpm typecheck',
      error: TAIL_ERROR,
      shell: true,
    },
  },
  {
    id: 302,
    at: '2026-11-23T15:10:00Z',
    role: 'builder',
    project: '/work/app',
    workItem: 41,
    sessionId: BUILD_SESSION,
    sessionTitle: 'Build the frictions page',
    exitCode: 1,
    hasMore: false,
    details: 'local',
    texts: {
      kind: 'tool-error',
      input: 'test -f dist/index.html',
      error: '',
      shell: true,
    },
  },
  {
    id: 303,
    at: '2026-11-23T14:55:00Z',
    role: 'reviewer',
    project: '/work/app',
    workItem: 41,
    sessionId: BUILD_SESSION,
    sessionTitle: 'Build the frictions page',
    exitCode: null,
    hasMore: true,
    details: 'local',
    texts: {
      kind: 'tool-error',
      input: '{"file_path":"~/work/app/src/ui/App.tsx"}',
      error: HEAD_ERROR,
      shell: false,
    },
  },
];

export const FULL_OUTPUT = [
  '… 12 earlier lines not shown.',
  ...Array.from(
    { length: 24 },
    (_, index) =>
      `Checking formatting… src/ui/component-${String(index + 1).padStart(2, '0')}.tsx ok`,
  ),
  `src/ui/${'very-long-folder-name/'.repeat(6)}App.tsx(12,7): error TS2322: Type 'string' is not assignable to type 'number'.`,
  '',
  'Found 2 errors in 2 files.',
].join('\n');

export function outputLoaderOf(text: string = FULL_OUTPUT): LoadOutput {
  return () => Promise.resolve({ status: 'ok', gone: false, text });
}

export const pendingOutput: LoadOutput = () =>
  new Promise<never>(() => undefined);

export const unreachableOutput: LoadOutput = () =>
  Promise.resolve({ status: 'unreachable', refreshSeconds: 10 });

export const goneOutput: LoadOutput = () =>
  Promise.resolve({ status: 'ok', gone: true });

export function okOccurrences(
  occurrences: FrictionOccurrence[],
): OccurrencesResponse {
  return { status: 'ok', occurrences };
}

export function occurrencesLoaderOf(
  occurrences: FrictionOccurrence[] = toolOccurrences,
): LoadOccurrences {
  return ({ table }) =>
    Promise.resolve(
      okOccurrences(table === 'hook' ? hookOccurrences : occurrences),
    );
}

export const pendingOccurrences: LoadOccurrences = () =>
  new Promise<never>(() => undefined);

export const unreachableOccurrences: LoadOccurrences = () =>
  Promise.resolve({ status: 'unreachable', refreshSeconds: 10 });

export const offlineOccurrences: LoadOccurrences = () =>
  Promise.resolve(undefined);

export const remoteOutput: LoadOutput = () =>
  Promise.resolve({ status: 'ok', gone: true, remote: true });
