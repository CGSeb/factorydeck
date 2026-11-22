import { describe, expect, it } from 'vitest';
import {
  issueMilestones,
  milestonesSince,
  needsSpecEpisodes,
} from './milestones.ts';
import { firstScore, refusalReasons } from './outcome.ts';
import type { SerenityReport } from './types.ts';

function report(
  score: number,
  at: string,
  extra: Partial<SerenityReport> = {},
): SerenityReport {
  return { score, threshold: 80, rounds: 1, gatesPassed: true, at, ...extra };
}

describe('refusal reasons', () => {
  it('lists each reason that applies, in order', () => {
    expect(refusalReasons(report(85, 'x'), true)).toEqual([]);
    expect(refusalReasons(report(85, 'x'), null)).toEqual([]);
    expect(refusalReasons(report(70, 'x'), true)).toEqual(['below-threshold']);
    expect(
      refusalReasons(report(70, 'x', { gatesPassed: false }), false),
    ).toEqual(['below-threshold', 'gates-failed', 'auto-merge-off']);
    expect(refusalReasons(report(80, 'x'), false)).toEqual(['auto-merge-off']);
  });
});

describe('needs-spec episodes', () => {
  it('pairs each addition with the next removal', () => {
    expect(
      needsSpecEpisodes([
        { added: false, at: '2026-03-01T09:00:00Z' },
        { added: true, at: '2026-03-01T10:00:00Z' },
        { added: false, at: '2026-03-01T12:00:00Z' },
        { added: true, at: '2026-03-02T10:00:00Z' },
        { added: true, at: '2026-03-02T11:00:00Z' },
      ]),
    ).toEqual([
      {
        kind: 'needs-spec',
        at: '2026-03-01T10:00:00Z',
        removedAt: '2026-03-01T12:00:00Z',
      },
      { kind: 'needs-spec', at: '2026-03-02T10:00:00Z', removedAt: null },
    ]);
  });
});

describe('issue milestones', () => {
  it('gives every report of every request and every episode in time order', () => {
    expect(
      issueMilestones(
        [
          {
            number: 21,
            url: 'https://example.test/21',
            reports: [
              report(90, '2026-03-01T10:00:00Z', { gatesPassed: false }),
            ],
          },
          {
            number: 22,
            url: 'https://example.test/22',
            reports: [report(88, '2026-03-03T10:00:00Z')],
          },
        ],
        [
          { added: true, at: '2026-03-02T10:00:00Z' },
          { added: false, at: '2026-03-02T12:00:00Z' },
        ],
        true,
      ),
    ).toEqual([
      {
        kind: 'report',
        at: '2026-03-01T10:00:00Z',
        request: { number: 21, url: 'https://example.test/21' },
        score: 90,
        threshold: 80,
        refused: true,
        reasons: ['gates-failed'],
      },
      {
        kind: 'needs-spec',
        at: '2026-03-02T10:00:00Z',
        removedAt: '2026-03-02T12:00:00Z',
      },
      {
        kind: 'report',
        at: '2026-03-03T10:00:00Z',
        request: { number: 22, url: 'https://example.test/22' },
        score: 88,
        threshold: 80,
        refused: false,
        reasons: [],
      },
    ]);
  });

  it('keeps only the milestones inside the period', () => {
    const milestones = issueMilestones(
      [
        {
          number: 1,
          url: 'u',
          reports: [
            report(60, '2026-03-01T10:00:00Z'),
            report(85, '2026-03-03T10:00:00Z'),
          ],
        },
      ],
      [
        { added: true, at: '2026-03-01T11:00:00Z' },
        { added: false, at: '2026-03-03T11:00:00Z' },
      ],
      true,
    );
    expect(
      milestonesSince(milestones, '2026-03-03T10:00:00Z').map(
        (milestone) => milestone.at,
      ),
    ).toEqual(['2026-03-03T10:00:00Z']);
    expect(milestonesSince(milestones, null)).toHaveLength(3);
  });
});

describe('score path', () => {
  const at = (day: number): string => `2026-03-0${String(day)}T10:00:00Z`;

  it('has no first score with one report or equal scores', () => {
    const one = report(70, at(1));
    expect(firstScore({ report: one, reports: [one] })).toBeUndefined();
    const last = report(70, at(2));
    expect(
      firstScore({ report: last, reports: [report(70, at(1)), last] }),
    ).toBeUndefined();
    expect(firstScore({ report: null, reports: [] })).toBeUndefined();
  });

  it('gives the first score when it rose or fell', () => {
    const rose = report(88, at(3));
    expect(
      firstScore({
        report: rose,
        reports: [report(80, at(2)), report(60, at(1)), rose],
      }),
    ).toBe(60);
    const fell = report(72, at(2));
    expect(
      firstScore({ report: fell, reports: [report(85, at(1)), fell] }),
    ).toBe(85);
  });
});
