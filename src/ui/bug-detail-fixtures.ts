import type { FeatureDetail } from '../features/types.ts';
import { fixRequest } from './bug-fixtures.ts';
import {
  exportFeature,
  featureLoaderOf,
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
