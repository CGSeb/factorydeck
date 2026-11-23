import type {
  FrictionOccurrence,
  OccurrencesResponse,
} from '../frictions/occurrence-types.ts';
import type { LoadOccurrences } from './occurrences-api.ts';

const BUILD_SESSION = '7f3a9c21-5b1e-4c8d-9a0f-123456789abc';
const MAIN_SESSION = '0a1b2c3d-4e5f-4a6b-8c7d-0123456789ef';

export const LONG_ERROR = `Error: Cannot find module '~/work/app/src/${'deeply/nested/'.repeat(12)}missing.ts' imported from ~/work/app/src/index.ts`;

export const toolOccurrences: FrictionOccurrence[] = [
  {
    at: '2026-11-22T17:33:00Z',
    role: 'builder',
    project: '/work/app',
    workItem: 41,
    sessionId: BUILD_SESSION,
    sessionTitle: 'Build the frictions page',
    texts: {
      kind: 'tool-error',
      input: 'cd ~/work/app && git push origin feat/41-frictions',
      error:
        '! [rejected] feat/41-frictions -> feat/41-frictions (non-fast-forward)\nerror: failed to push some refs\nhint: Updates were rejected because the tip of your branch is behind',
    },
  },
  {
    at: '2026-11-22T11:05:00Z',
    role: 'reviewer',
    project: '/work/app',
    workItem: 41,
    sessionId: BUILD_SESSION,
    sessionTitle: 'Build the frictions page',
    texts: {
      kind: 'tool-error',
      input: `git commit -m "${'a long commit subject '.repeat(6)}"`,
      error: LONG_ERROR,
    },
  },
  {
    at: '2026-11-21T09:05:00Z',
    role: 'main',
    project: '/work/app',
    workItem: null,
    sessionId: MAIN_SESSION,
    sessionTitle: '',
    texts: null,
  },
];

export const hookOccurrences: FrictionOccurrence[] = [
  {
    at: '2026-11-20T11:00:00Z',
    role: 'builder',
    project: '/work/app',
    workItem: 41,
    sessionId: BUILD_SESSION,
    sessionTitle: 'Build the frictions page',
    texts: {
      kind: 'stop-blocked',
      message: 'pnpm check failed: 2 type errors\nRun pnpm typecheck',
    },
  },
];

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
