import { describe, expect, it } from 'vitest';
import {
  frictionStats,
  noFrictionStats,
  okFrictions,
} from './frictions-fixtures.ts';
import { lastReportOf } from './FrictionReportActions.tsx';
import { reportBlock } from './FrictionsPage.tsx';

describe('reportBlock', () => {
  const ok = okFrictions(frictionStats);

  it('lets the report be copied once the selection on screen has frictions', () => {
    expect(reportBlock(ok, '/work/app')).toBeNull();
  });

  it('blocks the copy while the page loads or reloads', () => {
    expect(reportBlock(undefined, '/work/app')).toBe('loading');
    expect(reportBlock(ok, '/work/app', true)).toBe('loading');
  });

  it('blocks the copy with no friction, and under All projects first', () => {
    expect(reportBlock(okFrictions(noFrictionStats), '/work/app')).toBe(
      'empty',
    );
    expect(reportBlock(ok, undefined, true)).toBe('all-projects');
  });
});

describe('lastReportOf', () => {
  const at = '2026-11-23T07:00:00.000Z';
  const ok = okFrictions({ ...frictionStats, lastReportAt: at });

  it('gives the time the page loaded for the selected project', () => {
    expect(lastReportOf(ok, '/work/app', undefined)).toBe(at);
    expect(
      lastReportOf(okFrictions(frictionStats), '/work/app', undefined),
    ).toBeNull();
    expect(lastReportOf(undefined, '/work/app', undefined)).toBeNull();
  });

  it('gives nothing under All projects', () => {
    expect(
      lastReportOf(ok, undefined, { project: '/work/app', at }),
    ).toBeNull();
  });

  it('takes a report just marked for the same project only', () => {
    const later = '2026-11-23T08:00:00.000Z';
    expect(
      lastReportOf(ok, '/work/app', { project: '/work/app', at: later }),
    ).toBe(later);
    expect(
      lastReportOf(ok, '/work/app', { project: '/work/lib', at: later }),
    ).toBe(at);
    expect(
      lastReportOf(ok, '/work/app', {
        project: '/work/app',
        at: '2026-11-23T06:00:00.000Z',
      }),
    ).toBe(at);
  });
});
