import { describe, expect, it } from 'vitest';
import { autonomyLoader, flowLoader, qualityLoader } from './stats-api.ts';
import {
  autonomyFigures,
  autonomySummary,
  comparisonText,
  flowFigures,
  issueLabel,
  oneDecimal,
  qualityFigures,
  reasonRows,
  roundsLine,
  signedPoints,
  stripItems,
  tokenShares,
  waitingNote,
} from './stats-view.ts';

const HOUR = 3_600_000;

describe('stats view', () => {
  it('names the previous period of each period', () => {
    expect(comparisonText('today')).toBe('yesterday');
    expect(comparisonText('7d')).toBe('previous 7 days');
    expect(comparisonText('30d')).toBe('previous 30 days');
    expect(comparisonText('all')).toBeUndefined();
  });

  it('sums up the merged issues', () => {
    const counts = { mergedAfterQuestion: 0, stopWaitsMs: [] };
    expect(
      autonomySummary({ ...counts, merged: 1, mergedWithoutPerson: 1 }),
    ).toBe('1 issue merged · 1 without a person');
    expect(
      autonomySummary({ ...counts, merged: 4, mergedWithoutPerson: 3 }),
    ).toBe('4 issues merged · 3 without a person');
    expect(
      autonomySummary({ ...counts, merged: 0, mergedWithoutPerson: 0 }),
    ).toBe('No issue merged');
  });

  it('computes the shares and the median wait', () => {
    expect(
      autonomyFigures({
        merged: 4,
        mergedWithoutPerson: 3,
        mergedAfterQuestion: 1,
        stopWaitsMs: [HOUR, 3 * HOUR],
      }),
    ).toEqual({ withoutPerson: 0.75, specQuestions: 0.25, waiting: 2 * HOUR });
    expect(
      autonomyFigures({
        merged: 0,
        mergedWithoutPerson: 0,
        mergedAfterQuestion: 0,
        stopWaitsMs: [],
      }),
    ).toEqual({ withoutPerson: null, specQuestions: null, waiting: null });
    expect(
      autonomyFigures({
        merged: 0,
        mergedWithoutPerson: 0,
        mergedAfterQuestion: 0,
        stopWaitsMs: [1, 2, 3, 4, 5].map((hours) => hours * HOUR),
      }).waiting,
    ).toBe(3 * HOUR);
  });

  it('notes the questions still waiting, none at 0', () => {
    expect(waitingNote(2)).toBe('2 still waiting');
    expect(waitingNote(0)).toBeUndefined();
  });

  const reasons = {
    below1To5: 1,
    below6To15: 2,
    below16Plus: 3,
    gatesFailed: 4,
    specQuestion: 5,
    autoMergeOff: 6,
    total: 21,
    roundsSum: 9,
    roundsCount: 5,
  };

  it('lists the six rows in their order', () => {
    expect(reasonRows(reasons)).toEqual([
      { label: '1–5 pts below threshold', count: 1 },
      { label: '6–15 pts below threshold', count: 2 },
      { label: '16+ pts below threshold', count: 3 },
      { label: 'Gates failed', count: 4 },
      { label: 'Spec question', count: 5 },
      { label: 'Auto-merge off', count: 6 },
    ]);
  });

  it('gives the mean review rounds before a stop from the minimum sample', () => {
    expect(roundsLine(reasons)).toBe(
      '1.8 review rounds on average before a stop',
    );
    expect(roundsLine({ ...reasons, roundsCount: 4 })).toBe(
      'Not enough data for review rounds before a stop',
    );
  });
});

describe('autonomy API', () => {
  it('asks for the autonomy figures of the period and project', async () => {
    const urls: string[] = [];
    const response = await autonomyLoader(
      (input) => {
        urls.push(typeof input === 'string' ? input : '');
        return Promise.resolve(Response.json({ status: 'unreachable' }));
      },
      () => 'UTC',
    )({ period: '30d', project: '/work/app' });
    expect(response).toEqual({ status: 'unreachable' });
    expect(urls).toEqual([
      '/api/stats/autonomy?period=30d&tz=UTC&project=%2Fwork%2Fapp',
    ]);
  });

  it('gives nothing for an unexpected answer', async () => {
    await expect(
      autonomyLoader(
        () => Promise.resolve(Response.json({ error: 'nope' })),
        () => 'UTC',
      )({ period: '7d', project: undefined }),
    ).resolves.toBeUndefined();
  });
});

describe('quality view', () => {
  const counts = {
    merged: 5,
    mergedWithReport: 4,
    firstPassed: 3,
    roundsSum: 7,
    roundsCount: 5,
    gainSum: -7,
    gainCount: 2,
  };

  it('computes the three quality figures', () => {
    expect(qualityFigures(counts)).toEqual({
      firstTime: 0.75,
      rounds: 1.4,
      gain: -3.5,
    });
  });

  it('writes the score gain as whole points with a sign', () => {
    expect(signedPoints(12.4)).toBe('+12 pts');
    expect(signedPoints(-3.5)).toBe('−3 pts');
    expect(signedPoints(-3.6)).toBe('−4 pts');
    expect(signedPoints(-0.4)).toBe('0 pts');
    expect(signedPoints(0)).toBe('0 pts');
    expect(signedPoints(1)).toBe('+1 pt');
  });

  it('has no figure without a merged issue', () => {
    expect(
      qualityFigures({
        ...counts,
        merged: 0,
        mergedWithReport: 0,
        firstPassed: 0,
        roundsSum: 0,
        roundsCount: 0,
        gainSum: 0,
        gainCount: 0,
      }),
    ).toEqual({
      firstTime: null,
      rounds: null,
      gain: null,
    });
  });

  it('shows the review rounds with one decimal', () => {
    expect(oneDecimal(1.4)).toBe('1.4');
    expect(oneDecimal(1)).toBe('1.0');
    expect(oneDecimal(1.25)).toBe('1.3');
  });
});

describe('quality API', () => {
  it('asks for the quality figures of the period and project', async () => {
    const urls: string[] = [];
    const response = await qualityLoader(
      (input) => {
        urls.push(typeof input === 'string' ? input : '');
        return Promise.resolve(Response.json({ status: 'unreachable' }));
      },
      () => 'UTC',
    )({ period: '7d', project: '/work/app' });
    expect(response).toEqual({ status: 'unreachable' });
    expect(urls).toEqual([
      '/api/stats/quality?period=7d&tz=UTC&project=%2Fwork%2Fapp',
    ]);
  });

  it('gives nothing for an unexpected answer', async () => {
    await expect(
      qualityLoader(
        () => Promise.resolve(Response.json({ error: 'nope' })),
        () => 'UTC',
      )({ period: '7d', project: undefined }),
    ).resolves.toBeUndefined();
  });
  it('reads the flow figures from the merged issues', () => {
    expect(
      flowFigures([
        { leadMs: 3 * HOUR, cycleMs: null, tokens: null },
        { leadMs: 1 * HOUR, cycleMs: 1 * HOUR, tokens: 100 },
        { leadMs: 2 * HOUR, cycleMs: 3 * HOUR, tokens: 300 },
      ]),
    ).toEqual({
      lead: { value: 2 * HOUR, n: 3 },
      cycle: { value: 2 * HOUR, n: 2 },
      tokens: { value: 200, n: 2 },
    });
    expect(flowFigures([]).lead).toEqual({ value: null, n: 0 });
  });

  it('shares the tokens of the period', () => {
    expect(
      tokenShares({
        total: 200,
        droppedWork: 20,
        noWorkItem: 50,
        rework: 30,
        apiCalls: 9,
      }),
    ).toEqual({ droppedWork: 0.1, noWorkItem: 0.25, rework: 0.15 });
    expect(
      tokenShares({
        total: 0,
        droppedWork: 0,
        noWorkItem: 0,
        rework: 0,
        apiCalls: 0,
      }),
    ).toEqual({ droppedWork: null, noWorkItem: null, rework: null });
  });

  it('labels and links each issue of a strip, skipping missing values', () => {
    const issue = {
      project: '/work/my app',
      number: 7,
      title: 'Export',
      leadMs: HOUR,
      cycleMs: null,
      tokens: null,
    };
    expect(issueLabel(issue)).toBe('#7 Export');
    expect(issueLabel({ ...issue, title: ' ' })).toBe('#7');
    expect(stripItems([issue], (row) => row.leadMs, '7d')).toEqual([
      {
        label: '#7 Export',
        value: HOUR,
        href: '/features/7?project=%2Fwork%2Fmy+app&period=7d',
      },
    ]);
    expect(stripItems([issue], (row) => row.tokens, '7d')).toEqual([]);
  });

  it('asks the flow figures of the period and project', async () => {
    const urls: string[] = [];
    const response = await flowLoader(
      (input) => {
        urls.push(typeof input === 'string' ? input : '');
        return Promise.resolve(Response.json({ status: 'unreachable' }));
      },
      () => 'UTC',
    )({ period: 'all', project: '/work/app' });
    expect(response).toEqual({ status: 'unreachable' });
    expect(urls).toEqual([
      '/api/stats/flow?period=all&tz=UTC&project=%2Fwork%2Fapp',
    ]);
  });
});
