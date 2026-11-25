import { describe, expect, it } from 'vitest';
import { bugRow } from './bug-fixtures.ts';
import { bugsLoader } from './bugs-api.ts';
import { ageText, bugSummary, reproducedOf } from './bugs-view.ts';

const NOW = new Date('2026-03-12T15:30:00Z');

describe('ageText', () => {
  const created = { createdAt: '2026-03-12T12:25:00Z' };

  it('counts an open or fixing bug from its creation to now', () => {
    expect(ageText(bugRow(1, 'A', created), 'open', NOW)).toBe(
      'Open for 3 h 05 min',
    );
    expect(ageText(bugRow(1, 'A', created), 'fixing', NOW)).toBe(
      'Open for 3 h 05 min',
    );
  });

  it('counts a fixed bug to its merge, and a closed one to its close', () => {
    const start = { createdAt: '2026-03-10T10:00:00Z' };
    expect(
      ageText(
        bugRow(1, 'A', { ...start, mergedAt: '2026-03-11T14:00:00Z' }),
        'fixed',
        NOW,
      ),
    ).toBe('Fixed in 1 d 4 h');
    expect(
      ageText(
        bugRow(1, 'A', { ...start, closedAt: '2026-03-10T13:05:00Z' }),
        'fixed',
        NOW,
      ),
    ).toBe('Closed after 3 h 05 min');
  });
});

describe('ageText of a reopened bug', () => {
  const reopened = {
    createdAt: '2026-03-01T10:00:00Z',
    version: { number: 2, count: 2, startedAt: '2026-03-12T12:25:00Z' },
  };

  it('counts from the start of the current version, not the creation', () => {
    expect(ageText(bugRow(1, 'A', reopened), 'open', NOW)).toBe(
      'Open for 3 h 05 min',
    );
    expect(
      ageText(
        bugRow(1, 'A', { ...reopened, mergedAt: '2026-03-12T14:25:00Z' }),
        'fixed',
        NOW,
      ),
    ).toBe('Fixed in 2 h 00 min');
    expect(
      ageText(
        bugRow(1, 'A', { ...reopened, closedAt: '2026-03-12T13:25:00Z' }),
        'fixed',
        NOW,
      ),
    ).toBe('Closed after 1 h 00 min');
  });
});

describe('bugSummary', () => {
  it('adds the closed bugs only when there are some', () => {
    expect(bugSummary({ open: 3, fixed: 2, closed: 0 })).toBe(
      '3 open · 2 fixed',
    );
    expect(bugSummary({ open: 3, fixed: 2, closed: 1 })).toBe(
      '3 open · 2 fixed · 1 closed without a fix',
    );
  });
});

describe('reproducedOf', () => {
  it('gives a dash with no fix or no value', () => {
    expect(reproducedOf(null)).toEqual({ text: '—', tone: null });
    expect(reproducedOf({ rootCause: 'x', reproduced: null })).toEqual({
      text: '—',
      tone: null,
    });
    expect(
      reproducedOf({ rootCause: null, reproduced: 'failed-on-main' }),
    ).toEqual({ text: 'Failed on main', tone: 'success' });
  });
});

describe('bugsLoader', () => {
  it('asks for the bugs of the period, project and time zone', async () => {
    const urls: string[] = [];
    const body = { status: 'unreachable', refreshSeconds: 10 };
    const response = await bugsLoader(
      (input) => {
        urls.push(typeof input === 'string' ? input : '');
        return Promise.resolve(Response.json(body));
      },
      () => 'Europe/Paris',
    )({ period: '30d', project: '/work/app' });
    expect(response).toEqual(body);
    expect(urls).toEqual([
      '/api/bugs?period=30d&tz=Europe%2FParis&project=%2Fwork%2Fapp',
    ]);
  });
});
