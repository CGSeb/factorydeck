import { describe, expect, it } from 'vitest';
import { latestReport, parseReport, reportHistory } from './report.ts';

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

  it('leaves the merge to the score without a gates line', () => {
    expect(parseReport('## Serenity: 90/100 (threshold 80)', AT)).toMatchObject(
      { gatesPassed: true, rounds: null },
    );
  });

  it.each([
    'Gates: passed. The pull request targets `2.0`.',
    'Gates: Passed, CI green.',
    'Gates: all passed',
  ])('reads « %s » as passed gates', (line) => {
    expect(
      parseReport(`## Serenity: 90/100 (threshold 80)\n${line}`, AT),
    ).toMatchObject({ gatesPassed: true });
  });

  it('reads a gates line naming a failure as failed gates', () => {
    expect(
      parseReport(
        '## Serenity: 90/100 (threshold 80)\nGates: failed: CI, One issue.',
        AT,
      ),
    ).toMatchObject({ gatesPassed: false });
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

describe('reportHistory', () => {
  it('keeps every report in time order and ignores other comments', () => {
    const history = reportHistory([
      {
        body: '## Serenity: 85/100 (threshold 80)\nGates: all passed.',
        createdAt: '2026-03-02T12:00:00.000Z',
      },
      { body: 'Looks good to me.', createdAt: '2026-03-02T10:00:00.000Z' },
      {
        body: '## Serenity: 60/100 (threshold 80)\nReview: 1 round.',
        createdAt: '2026-03-02T09:00:00.000Z',
      },
      { body: '## Serenity: 90/100 (threshold 80)', createdAt: null },
    ]);
    expect(history).toEqual([
      {
        score: 60,
        threshold: 80,
        rounds: 1,
        gatesPassed: true,
        at: '2026-03-02T09:00:00.000Z',
      },
      {
        score: 85,
        threshold: 80,
        rounds: null,
        gatesPassed: true,
        at: '2026-03-02T12:00:00.000Z',
      },
    ]);
  });
});

describe('parseReport on a fix-bug report', () => {
  const heading = '## Serenity: 88/100 (threshold 80)';

  it.each([
    ['failed on main', 'failed-on-main'],
    ['passed on main', 'passed-on-main'],
    ['did not run on main', 'did-not-run-on-main'],
    ['no test', 'no-test'],
  ] as const)('reads Reproduced: %s', (text, value) => {
    const body = report([
      heading,
      'Gates: all passed.',
      'Root cause: the export reads an empty list.',
      `Reproduced: ${text}`,
    ]);
    expect(parseReport(body, AT)).toMatchObject({
      rootCause: 'the export reads an empty list.',
      reproduced: value,
    });
  });

  it.each(['Reproduced: Failed on main', 'Reproduced: failed', 'Reproduced:'])(
    'gives no value for %s',
    (line) => {
      expect(parseReport(report([heading, line]), AT)).not.toHaveProperty(
        'reproduced',
      );
    },
  );

  it.each(['Root cause: none', 'Root cause:   ', 'Root cause:'])(
    'gives no root cause for %s',
    (line) => {
      expect(parseReport(report([heading, line]), AT)).not.toHaveProperty(
        'rootCause',
      );
    },
  );

  it('trims the root cause', () => {
    const body = report([heading, 'Root cause:   a stale cache  ']);
    expect(parseReport(body, AT)?.rootCause).toBe('a stale cache');
  });

  it('ignores the lines inside a code fence', () => {
    const body = report([
      heading,
      '```',
      'Root cause: inside the fence',
      'Reproduced: failed on main',
      '```',
    ]);
    const parsed = parseReport(body, AT);
    expect(parsed).not.toHaveProperty('rootCause');
    expect(parsed).not.toHaveProperty('reproduced');
  });

  it('cuts a 250-character root cause at 199 characters with an ellipsis', () => {
    const sentence = 'x'.repeat(250);
    const parsed = parseReport(
      report([heading, `Root cause: ${sentence}`]),
      AT,
    );
    expect(parsed?.rootCause).toBe(`${'x'.repeat(199)}…`);
    expect(Array.from(parsed?.rootCause ?? '')).toHaveLength(200);
  });

  it('keeps a 200-character root cause whole', () => {
    const sentence = 'y'.repeat(200);
    const parsed = parseReport(
      report([heading, `Root cause: ${sentence}`]),
      AT,
    );
    expect(parsed?.rootCause).toBe(sentence);
  });

  it('counts the first line of each kind', () => {
    const body = report([
      heading,
      'Root cause: the first cause',
      'Reproduced: no test',
      'Root cause: the second cause',
      'Reproduced: failed on main',
    ]);
    expect(parseReport(body, AT)).toMatchObject({
      rootCause: 'the first cause',
      reproduced: 'no-test',
    });
  });

  it('gives neither to a build-feature report', () => {
    const body = report([
      heading,
      '',
      '- −5: 1 review finding fixed',
      '',
      'Gates: all passed. Review: 1 round, confidence high.',
    ]);
    expect(parseReport(body, AT)).toEqual({
      score: 88,
      threshold: 80,
      rounds: 1,
      gatesPassed: true,
      at: AT,
    });
  });
});
