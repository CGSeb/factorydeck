import { describe, expect, it } from 'vitest';
import { byStart, hasSkill, kindSegments } from './session-detail.ts';
import { sessionCountText, stateOptions } from './session-list.ts';
import { sessionWithSubAgents } from './session-fixtures.ts';

describe('sessionCountText', () => {
  it('says session for one and sessions otherwise', () => {
    expect(sessionCountText(1)).toBe('1 session');
    expect(sessionCountText(0)).toBe('0 sessions');
    expect(sessionCountText(1234)).toBe('1,234 sessions');
  });
});

describe('stateOptions', () => {
  it('gives All with the sum, then each state with its count and dot', () => {
    const options = stateOptions({ working: 2, waiting: 1, inactive: 4 });
    expect(
      options.map(({ value, label, count }) => [value, label, count]),
    ).toEqual([
      ['all', 'All', 7],
      ['working', 'Working', 2],
      ['waiting', 'Waiting for you', 1],
      ['inactive', 'Inactive', 4],
    ]);
    expect(options[0]?.dot).toBeUndefined();
    expect(options.slice(1).every(({ dot }) => dot !== undefined)).toBe(true);
  });
});

describe('byStart', () => {
  const [first, second, third] = sessionWithSubAgents.subAgents;
  if (first === undefined || second === undefined || third === undefined) {
    throw new Error('fixture has three sub-agents');
  }

  it('sorts sub-agents by start, without a start last, ties kept in order', () => {
    const unstarted = { ...first, id: 'none', firstAt: null };
    const twin = { ...second, id: 'twin' };
    expect(
      byStart([unstarted, third, second, twin, first]).map(({ id }) => id),
    ).toEqual([first.id, second.id, 'twin', third.id, 'none']);
  });
});

describe('kindSegments', () => {
  it('gives the four kinds in order, with their colours', () => {
    expect(
      kindSegments(sessionWithSubAgents).map(({ label, value, color }) => [
        label,
        value,
        color,
      ]),
    ).toEqual([
      ['Cache read', 3_610_000, 'var(--fd-kind-cache-read)'],
      ['Cache write', 410_000, 'var(--fd-kind-cache-write)'],
      ['Input', 120_400, 'var(--fd-kind-input)'],
      ['Output', 69_600, 'var(--fd-kind-output)'],
    ]);
  });
});

describe('hasSkill', () => {
  it('is false when only the no-skill share is there', () => {
    expect(hasSkill(sessionWithSubAgents.skills)).toBe(true);
    expect(
      hasSkill(
        sessionWithSubAgents.skills.filter(({ skill }) => skill === null),
      ),
    ).toBe(false);
    expect(hasSkill([])).toBe(false);
  });
});
