import { describe, expect, it } from 'vitest';
import {
  compactTokens,
  exitCodesText,
  frictionSummary,
  kindOptions,
  perHundred,
  programText,
  shareText,
  shortSessionTitle,
  weekBuckets,
} from './frictions-view.ts';

describe('frictionSummary', () => {
  it('gives the frictions and their rate per 100 API calls', () => {
    expect(frictionSummary({ frictions: 12, apiCalls: 500 })).toBe(
      '12 frictions · 2.4 per 100 API calls',
    );
    expect(frictionSummary({ frictions: 1, apiCalls: 250 })).toBe(
      '1 friction · 0.4 per 100 API calls',
    );
    expect(frictionSummary({ frictions: 3, apiCalls: 3 })).toBe(
      '3 frictions · 100.0 per 100 API calls',
    );
  });

  it('gives the API calls when there is no friction', () => {
    expect(frictionSummary({ frictions: 0, apiCalls: 1200 })).toBe(
      'No friction · 1,200 API calls',
    );
    expect(frictionSummary({ frictions: 0, apiCalls: 1 })).toBe(
      'No friction · 1 API call',
    );
  });

  it('gives no rate without an API call', () => {
    expect(frictionSummary({ frictions: 2, apiCalls: 0 })).toBe(
      '2 frictions · — per 100 API calls',
    );
  });
});

describe('perHundred', () => {
  it('rounds to one decimal', () => {
    expect(perHundred(1, 3)).toBe(33.3);
    expect(perHundred(0, 10)).toBe(0);
    expect(perHundred(4, 0)).toBeNull();
  });
});

describe('kindOptions', () => {
  it('counts every kind and All', () => {
    expect(
      kindOptions({ 'tool-error': 4, 'stop-blocked': 1, compaction: 0 }),
    ).toEqual([
      { value: 'all', label: 'All', count: 5 },
      { value: 'tool-error', label: 'Tool errors', count: 4 },
      { value: 'stop-blocked', label: 'Stop blocked', count: 1 },
      { value: 'compaction', label: 'Compactions', count: 0 },
    ]);
  });
});

describe('weekBuckets', () => {
  it('gives each week its rate, with its API calls as n', () => {
    expect(
      weekBuckets([
        { start: '2026-11-09', frictions: 12, apiCalls: 500 },
        { start: '2026-11-16', frictions: 1, apiCalls: 0 },
        { start: '2026-11-23', frictions: 1, apiCalls: 40 },
      ]),
    ).toEqual([
      { label: 'Nov 9', value: 2.4, n: 500, text: '2.4 · 12 frictions' },
      { label: 'Nov 16', value: null, n: 0, text: '— · 1 friction' },
      { label: 'this week', value: 2.5, n: 40, text: '2.5 · 1 friction' },
    ]);
  });
});

describe('shareText', () => {
  it('gives a whole percent, <1% above 0', () => {
    expect(shareText(1, 3)).toBe('33%');
    expect(shareText(1, 400)).toBe('<1%');
    expect(shareText(0, 4)).toBe('0%');
    expect(shareText(4, 4)).toBe('100%');
  });
});

describe('exitCodesText', () => {
  it('lists at most 5 codes', () => {
    expect(exitCodesText([])).toBe('—');
    expect(exitCodesText([1, 2, 127])).toBe('1, 2, 127');
    expect(exitCodesText([1, 2, 3, 4, 5])).toBe('1, 2, 3, 4, 5');
    expect(exitCodesText([1, 2, 3, 4, 5, 6, 7])).toBe('1, 2, 3, 4, 5, …');
  });
});

describe('compactTokens', () => {
  it('writes tokens compactly', () => {
    expect(compactTokens(306_000)).toBe('306K');
    expect(compactTokens(158_400)).toBe('158.4K');
    expect(compactTokens(1_000_000)).toBe('1M');
    expect(compactTokens(950)).toBe('950');
    expect(compactTokens(null)).toBe('—');
  });
});

describe('labels', () => {
  it('writes a missing program and an untitled session', () => {
    expect(programText(null)).toBe('—');
    expect(programText('pnpm')).toBe('pnpm');
    expect(shortSessionTitle('', '0123456789abcdef')).toBe('01234567');
    expect(shortSessionTitle('Fix login', '0123456789abcdef')).toBe(
      'Fix login',
    );
  });
});
