import { describe, expect, it } from 'vitest';
import { latestReport, parseReport } from './report.ts';

const AT = '2026-03-02T10:00:00.000Z';

function report(lines: string[]): string {
  return lines.join('\n');
}

describe('parseReport', () => {
  it('reads the score, threshold, rounds and passed gates', () => {
    const body = report([
      '## Serenity: 85/100 (threshold 80)',
      '',
      '- −5: 1 review finding fixed',
      '',
      'Gates: all passed. Review: 1 round, confidence high.',
    ]);
    expect(parseReport(body, AT)).toEqual({
      score: 85,
      threshold: 80,
      rounds: 1,
      gatesPassed: true,
      at: AT,
    });
  });

  it('reads rounds from a line of their own, and gates with details', () => {
    const body = report([
      '## Serenity: 42/100 (threshold 80), after the second review',
      'Gates: all passed (open, base main, CI green).',
      'Review: 3 rounds (the last on the fix), confidence high.',
    ]);
    expect(parseReport(body, AT)).toMatchObject({
      score: 42,
      threshold: 80,
      rounds: 3,
      gatesPassed: true,
    });
  });

  it('has no rounds without a review line, and failed gates', () => {
    const body = report([
      '## Serenity: 77/100 (threshold 80)',
      'Gates: one failed. Review: first round without findings.',
    ]);
    expect(parseReport(body, AT)).toMatchObject({
      rounds: null,
      gatesPassed: false,
    });
  });

  it('counts the gates as failed without a gates line', () => {
    expect(parseReport('## Serenity: 90/100 (threshold 80)', AT)).toMatchObject(
      { gatesPassed: false, rounds: null },
    );
  });

  it('counts a gates line that only starts like a pass as failed', () => {
    expect(
      parseReport(
        '## Serenity: 90/100 (threshold 80)\nGates: all passedish.',
        AT,
      ),
    ).toMatchObject({ gatesPassed: false });
  });

  it('ignores a heading quoted inside a code block', () => {
    const body = report([
      'The report looks like this:',
      '',
      '```markdown',
      '## Serenity: 85/100 (threshold 80)',
      'Gates: all passed. Review: 1 round.',
      '```',
    ]);
    expect(parseReport(body, AT)).toBeUndefined();
  });

  it('ignores a heading inside a tilde fence or an indented code block', () => {
    expect(
      parseReport('~~~\n## Serenity: 85/100 (threshold 80)\n~~~', AT),
    ).toBeUndefined();
    expect(
      parseReport('    ## Serenity: 85/100 (threshold 80)', AT),
    ).toBeUndefined();
  });

  it('ignores a heading written mid-line', () => {
    expect(
      parseReport(
        'The last one said ## Serenity: 85/100 (threshold 80) on #12.',
        AT,
      ),
    ).toBeUndefined();
  });

  it('needs whole numbers', () => {
    expect(
      parseReport('## Serenity: 85.5/100 (threshold 80)', AT),
    ).toBeUndefined();
    expect(
      parseReport('## Serenity: high/100 (threshold 80)', AT),
    ).toBeUndefined();
  });

  it('reads a report after a closed code block', () => {
    const body = report([
      '```',
      '## Serenity: 10/100 (threshold 80)',
      '```',
      '## Serenity: 95/100 (threshold 90)',
    ]);
    expect(parseReport(body, AT)).toMatchObject({ score: 95, threshold: 90 });
  });
});

describe('latestReport', () => {
  it('keeps the latest report by comment time', () => {
    expect(
      latestReport([
        {
          body: '## Serenity: 70/100 (threshold 80)\nReview: 2 rounds.',
          createdAt: '2026-03-02T12:00:00.000Z',
        },
        {
          body: '## Serenity: 60/100 (threshold 80)\nReview: 1 round.',
          createdAt: '2026-03-02T09:00:00.000Z',
        },
        { body: 'Looks good to me.', createdAt: '2026-03-02T13:00:00.000Z' },
      ]),
    ).toMatchObject({ score: 70, rounds: 2, at: '2026-03-02T12:00:00.000Z' });
  });

  it('is null without a report', () => {
    expect(latestReport([])).toBeNull();
    expect(latestReport([{ body: 'Thanks!', createdAt: AT }])).toBeNull();
  });
});
