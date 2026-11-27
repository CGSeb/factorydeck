import { describe, expect, it } from 'vitest';
import {
  frictionStats,
  noFrictionStats,
  okFrictions,
} from './frictions-fixtures.ts';
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
