import type { BugVersionSpan } from '../bugs/types.ts';
import type { FeatureDetail, FeatureResponse } from '../features/types.ts';
import type { ClosingRequest, IssueOutcome } from '../git-host/types.ts';
import { fixRequest } from './bug-fixtures.ts';
import {
  exportFeature,
  featureLoaderOf,
  featureResponse,
  mergedByPersonIssue,
  uncollectedFeature,
} from './feature-detail-fixtures.ts';
import type { LoadFeature } from './features-api.ts';

function bugFeature(
  number: number,
  title: string,
  fix: FeatureDetail['fix'],
): FeatureDetail {
  const url = `https://github.com/example-org/example-app/issues/${String(number)}`;
  return {
    ...exportFeature,
    number,
    issue: { status: 'found', title, url },
    kind: 'bug',
    fix,
    version: {
      number: 1,
      count: 1,
      startedAt: '2026-11-17T09:00:00.000Z',
      endedAt: '2026-11-20T15:00:00.000Z',
      reopenedAt: null,
    },
    detail: {
      ...mergedByPersonIssue,
      number,
      title,
      url,
      labels: [{ name: 'bug', color: null }],
      outcome: {
        stage: 'merged',
        report: { score: 91, threshold: 80, rounds: 1 },
        reworked: false,
      },
    },
  };
}

export const fixedBug = bugFeature(70, 'Empty state shows twice', {
  rootCause: 'The empty state renders in the list and in the panel.',
  reproduced: 'failed-on-main',
  request: fixRequest(81),
});

export const passedBug = bugFeature(71, 'Date shifts by one day', {
  rootCause: null,
  reproduced: 'passed-on-main',
  request: fixRequest(82),
});

export const untestedBug = bugFeature(72, 'Tooltip cut off', {
  rootCause: 'The tooltip ignores the scroll offset.',
  reproduced: 'did-not-run-on-main',
  request: fixRequest(83),
});

export const noTestBug = bugFeature(73, 'Sort order lost on reload', {
  rootCause: 'The sort is not in the URL.',
  reproduced: 'no-test',
  request: fixRequest(84),
});

export const unknownReproducedBug = bugFeature(74, 'Badge overlaps title', {
  rootCause: 'A fixed width on the badge.',
  reproduced: null,
  request: fixRequest(85),
});

export const unfixedBug: FeatureDetail = {
  ...bugFeature(75, 'Login loops on refresh', null),
  detail: {
    ...mergedByPersonIssue,
    number: 75,
    title: 'Login loops on refresh',
    state: 'open',
    labels: [{ name: 'bug', color: null }],
    requests: [],
    outcome: { stage: 'open', report: null, reworked: false },
    milestones: [],
  },
};

const BUG_FEATURES: readonly FeatureDetail[] = [
  fixedBug,
  passedBug,
  untestedBug,
  noTestBug,
  unknownReproducedBug,
  unfixedBug,
];

export function bugPageLoader(): LoadFeature {
  return featureLoaderOf([exportFeature, uncollectedFeature, ...BUG_FEATURES]);
}

const VERSIONED_NUMBER = 76;

const VERSIONED_TITLE = 'Totals double after import';

const VERSIONED_URL = `https://github.com/example-org/example-app/issues/${String(VERSIONED_NUMBER)}`;

function versionRequest(
  number: number,
  state: ClosingRequest['state'],
): ClosingRequest {
  return {
    number,
    title: `fix: ${VERSIONED_TITLE}`,
    url: fixRequest(number).url,
    state,
    draft: false,
    checks: state === 'open' ? 'pending' : 'passing',
    createdAt: '2026-11-18T09:00:00.000Z',
  };
}

function versionOf(
  version: BugVersionSpan,
  {
    fix,
    outcome,
    requests,
    threads,
  }: {
    fix: FeatureDetail['fix'];
    outcome: IssueOutcome;
    requests: ClosingRequest[];
    threads: FeatureDetail['threads'];
  },
): FeatureDetail {
  return {
    ...exportFeature,
    number: VERSIONED_NUMBER,
    issue: { status: 'found', title: VERSIONED_TITLE, url: VERSIONED_URL },
    kind: 'bug',
    fix,
    version,
    threads,
    detail: {
      ...mergedByPersonIssue,
      number: VERSIONED_NUMBER,
      title: VERSIONED_TITLE,
      url: VERSIONED_URL,
      state: 'open',
      labels: [
        { name: 'bug', color: null },
        { name: 'agent:working', color: null },
      ],
      requests,
      outcome,
      milestones: [],
    },
  };
}

export const versionedBug: readonly FeatureDetail[] = [
  versionOf(
    {
      number: 1,
      count: 3,
      startedAt: '2026-11-10T09:00:00.000Z',
      endedAt: '2026-11-12T09:00:00.000Z',
      reopenedAt: '2026-11-14T09:00:00.000Z',
    },
    {
      fix: {
        rootCause: 'The import adds each row twice.',
        reproduced: 'no-test',
        request: fixRequest(91),
      },
      outcome: {
        stage: 'merged',
        report: { score: 84, threshold: 80, rounds: 1 },
        reworked: true,
      },
      requests: [versionRequest(91, 'merged')],
      threads: exportFeature.threads.slice(0, 1),
    },
  ),
  versionOf(
    {
      number: 2,
      count: 3,
      startedAt: '2026-11-14T09:00:00.000Z',
      endedAt: '2026-11-16T09:00:00.000Z',
      reopenedAt: '2026-11-17T09:00:00.000Z',
    },
    {
      fix: null,
      outcome: { stage: 'closed', report: null, reworked: true },
      requests: [],
      threads: [],
    },
  ),
  versionOf(
    {
      number: 3,
      count: 3,
      startedAt: '2026-11-17T09:00:00.000Z',
      endedAt: null,
      reopenedAt: null,
    },
    {
      fix: {
        rootCause: 'The totals read the rows before the import dedupes them.',
        reproduced: 'failed-on-main',
        request: fixRequest(93),
      },
      outcome: {
        stage: 'working',
        report: { score: 88, threshold: 80, rounds: 1 },
        reworked: true,
      },
      requests: [versionRequest(93, 'open')],
      threads: exportFeature.threads,
    },
  ),
];

const INVALID_VERSION_RESPONSE: FeatureResponse = {
  status: 'invalid-version',
  error: 'Expected version to be a version of a bug, from 1 to its count',
  refreshSeconds: 3600,
};

export function versionedBugLoader(
  pending: (version: number | undefined) => boolean = () => false,
): LoadFeature {
  const others = bugPageLoader();
  return (key, filters, version) => {
    if (key.number !== VERSIONED_NUMBER) return others(key, filters, version);
    if (pending(version)) return new Promise(() => undefined);
    const found =
      version === undefined ? versionedBug.at(-1) : versionedBug[version - 1];
    return Promise.resolve(
      found === undefined ? INVALID_VERSION_RESPONSE : featureResponse(found),
    );
  };
}
