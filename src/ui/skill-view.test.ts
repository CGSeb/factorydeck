import { describe, expect, it } from 'vitest';
import type { SkillSession, SkillUsage } from '../skills/types.ts';
import {
  skillsSummary,
  sortedSessions,
  sortedSkills,
  tokenTotal,
  tokensPerLaunch,
} from './skill-view.ts';
import { splitTokens } from './token-fixtures.ts';

function usage(
  skill: string | null,
  launches: number,
  tokens: number,
): SkillUsage {
  return {
    skill,
    launches,
    sessions: launches,
    apiCalls: 1,
    tokens,
    tokenCounts: splitTokens(tokens),
    costUsd: null,
    averageCostUsd: null,
  };
}

function session(id: string, tokens: number): SkillSession {
  return {
    id,
    title: id,
    project: '/home/dev/example-app',
    projectName: 'example-app',
    launches: 1,
    tokens,
    tokenCounts: splitTokens(tokens),
    costUsd: null,
  };
}

describe('skillsSummary', () => {
  it('counts launched skills, launches and their tokens, without No skill', () => {
    expect(
      skillsSummary([
        usage(null, 0, 9_000_000),
        usage('kit:review', 3, 1_200_000),
        usage('kit:write-spec', 2, 300_000),
        usage('kit:late', 0, 5_000),
      ]),
    ).toBe('2 skills launched 5 times · 1.5M tokens in skill sessions');
  });

  it('speaks in the singular for one skill launched once', () => {
    expect(skillsSummary([usage('kit:review', 1, 1)])).toBe(
      '1 skill launched 1 time · 1 token in skill sessions',
    );
  });

  it('says zero when no skill was launched', () => {
    expect(skillsSummary([usage(null, 0, 500)])).toBe(
      '0 skills launched 0 times · 0 tokens in skill sessions',
    );
  });
});

describe('sortedSkills', () => {
  it('sorts by tokens descending and keeps No skill last', () => {
    expect(
      sortedSkills([
        usage(null, 0, 9_000_000),
        usage('b', 1, 100),
        usage('c', 1, 500),
        usage('a', 1, 100),
      ]).map((row) => row.skill),
    ).toEqual(['c', 'a', 'b', null]);
  });
});

describe('sortedSessions', () => {
  it('sorts by tokens descending', () => {
    expect(
      sortedSessions([
        session('x', 10),
        session('y', 30),
        session('w', 10),
      ]).map((row) => row.id),
    ).toEqual(['y', 'w', 'x']);
  });
});

describe('tokensPerLaunch', () => {
  it('divides tokens by launches in the compact format', () => {
    expect(tokensPerLaunch(8_400_000, 21)).toBe('400.0K');
    expect(tokensPerLaunch(1000, 3)).toBe('333');
  });

  it('gives a dash without launches', () => {
    expect(tokensPerLaunch(5000, 0)).toBe('—');
  });
});

describe('tokenTotal', () => {
  it('adds up the rows, or 0 without rows', () => {
    expect(tokenTotal([{ tokens: 3 }, { tokens: 9 }])).toBe(12);
    expect(tokenTotal([])).toBe(0);
  });
});
