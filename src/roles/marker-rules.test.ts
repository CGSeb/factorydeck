import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RULES,
  type WorkflowRules,
  parseWorkflowConfig,
  workItemOf,
} from './config.ts';
import { markerAt, markerOf, markersOf } from './markers.ts';

const PATH = '/configs/factorydeck.yml';

function markerFile(...patterns: string[]): string {
  return [
    'version: 1',
    'work_items:',
    ...patterns.flatMap((pattern) => [
      '  - from: marker',
      `    pattern: '${pattern}'`,
    ]),
  ].join('\n');
}

function errorLines(text: string): string[] {
  try {
    parseWorkflowConfig(text, PATH);
  } catch (error) {
    const [, ...lines] = String(
      error instanceof Error ? error.message : error,
    ).split('\n');
    return lines;
  }
  throw new Error('Expected an invalid configuration');
}

function rulesOf(text: string): WorkflowRules {
  return parseWorkflowConfig(text, PATH).rules;
}

describe('marker rules', () => {
  it('lists the marker rule first among the defaults', () => {
    expect(DEFAULT_RULES.workItems.map((rule) => rule.from)).toEqual([
      'marker',
      'description',
      'title',
    ]);
  });

  it('reads the default markers, with and without a role', () => {
    expect(markerOf(DEFAULT_RULES, 'Work item: #88')).toEqual({
      workItem: 88,
      role: 'main',
    });
    expect(markerOf(DEFAULT_RULES, 'Work item: #88 (spec-writer)')).toEqual({
      workItem: 88,
      role: 'spec-writer',
    });
    expect(markerOf(DEFAULT_RULES, 'work item: #12 (Spec-Writer)')).toEqual({
      workItem: 12,
      role: 'spec-writer',
    });
    expect(markerOf(DEFAULT_RULES, 'Work item: #88 (unassigned)')?.role).toBe(
      'main',
    );
    expect(markerOf(DEFAULT_RULES, 'Work item: #88 (main)')?.role).toBe('main');
  });

  it('is not a marker without a positive whole number or a full match', () => {
    for (const line of [
      'Work item: #0',
      'Work item: #99999999999999999999',
      'See Work item: #4',
      'Work item: #4 (spec writer)',
      'Work item: #4.',
    ]) {
      expect(markerOf(DEFAULT_RULES, line)).toBeNull();
    }
  });

  it('is never read by the other sources', () => {
    expect(
      workItemOf(
        { roles: [], workItems: [DEFAULT_RULES.workItems[0]!] },
        { branch: 'Work item: #3', title: 'Work item: #3' },
      ),
    ).toBeNull();
  });

  it('takes the unnamed group as the issue, wherever the role group is', () => {
    const rules = rulesOf(
      markerFile('^\\[(?<role>[a-z-]+)\\] (?:issue )?#(\\d+)$'),
    );
    expect(rules.workItems[0]?.capture).toBe(2);
    expect(markerOf(rules, '[spec-writer] issue #31')).toEqual({
      workItem: 31,
      role: 'spec-writer',
    });
    expect(markerOf(rules, '[x] #(3)')).toBeNull();
  });

  it('reads no marker from a file whose list has no marker rule', () => {
    const rules = rulesOf(
      "version: 1\nwork_items:\n  - from: title\n    pattern: '#(\\d+)'",
    );
    expect(markerOf(rules, 'Work item: #88')).toBeNull();
  });

  it('reports invalid marker patterns as configuration errors', () => {
    expect(
      errorLines(
        markerFile(
          'Work item: #\\d+',
          '#(\\d+) (\\w+)',
          '#(\\d+) (?<agent>\\w+)',
          '#(?<role>\\d+)',
          '#((\\d+)',
          '#[(](\\d+)',
        ),
      ),
    ).toEqual([
      '  work_items[0].pattern: needs exactly one unnamed capture group, found 0',
      '  work_items[1].pattern: needs exactly one unnamed capture group, found 2',
      '  work_items[2].pattern: the only named group allowed is "role", found "agent"',
      '  work_items[3].pattern: needs exactly one unnamed capture group, found 0',
      expect.stringMatching(
        /^ {2}work_items\[4\]\.pattern: not a valid regular expression: /,
      ),
    ]);
  });
});

describe('markersOf', () => {
  const row = (at: string, line: string) => ({
    session_id: 's',
    project: '/work/app',
    at: new Date(at),
    line,
  });

  it('keeps the later of two markers with the same time', () => {
    const markers = markersOf({ ...emptyConfig(), rules: DEFAULT_RULES }, [
      row('2026-01-01T10:00:00Z', 'Work item: #1'),
      row('2026-01-01T10:00:00Z', 'Work item: #2 (spec-writer)'),
      row('2026-01-01T10:05:00Z', 'Nothing to see #4'),
      row('2026-01-01T11:00:00Z', 'Work item: #3'),
    ]).get('s');
    expect(markers?.map((marker) => marker.workItem)).toEqual([2, 3]);
    expect(markerAt(markers, '2026-01-01T09:00:00Z')?.workItem).toBe(2);
    expect(markerAt(markers, '2026-01-01T10:00:00Z')?.workItem).toBe(2);
    expect(markerAt(markers, '2026-01-01T10:30:00Z')?.workItem).toBe(3);
    expect(markerAt(markers, '2026-01-01T12:00:00Z')?.workItem).toBe(3);
    expect(markerAt(undefined, '2026-01-01T12:00:00Z')).toBeUndefined();
  });
});

function emptyConfig() {
  return parseWorkflowConfig('version: 1', PATH);
}
