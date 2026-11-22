import type { SkillSession, SkillUsage } from '../skills/types.ts';
import { MISSING, formatCount, formatTokens } from './format.ts';

function plural(count: number, one: string, many: string): string {
  return `${formatCount(count)} ${count === 1 ? one : many}`;
}

export function skillsSummary(skills: readonly SkillUsage[]): string {
  const named = skills.filter((row) => row.skill !== null);
  const launched = named.filter((row) => row.launches > 0).length;
  const launches = named.reduce((sum, row) => sum + row.launches, 0);
  const tokens = named.reduce((sum, row) => sum + row.tokens, 0);
  const tokenWord = tokens === 1 ? 'token' : 'tokens';
  return `${plural(launched, 'skill', 'skills')} launched ${plural(launches, 'time', 'times')} · ${formatTokens(tokens)} ${tokenWord} in skill sessions`;
}

function byTokens<T extends { tokens: number }>(
  name: (row: T) => string,
): (left: T, right: T) => number {
  return (left, right) =>
    right.tokens - left.tokens || name(left).localeCompare(name(right));
}

export function sortedSkills(skills: readonly SkillUsage[]): SkillUsage[] {
  const named = skills
    .filter((row) => row.skill !== null)
    .sort(byTokens((row) => row.skill ?? ''));
  return [...named, ...skills.filter((row) => row.skill === null)];
}

export function sortedSessions(
  sessions: readonly SkillSession[],
): SkillSession[] {
  return [...sessions].sort(byTokens((row) => row.id));
}

export function tokensPerLaunch(tokens: number, launches: number): string {
  return launches > 0 ? formatTokens(Math.round(tokens / launches)) : MISSING;
}

export function tokenTotal(rows: readonly { tokens: number }[]): number {
  return rows.reduce((sum, row) => sum + row.tokens, 0);
}
