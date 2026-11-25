import { describe, expect, it } from 'vitest';
import {
  issueHref,
  scopeOf,
  sessionHref,
  sessionsHref,
  skillHref,
} from './session-links.ts';

const both = { project: '/work/app', period: '7d' } as const;
const none = { project: undefined, period: undefined };

describe('scopeOf', () => {
  it('reads the project and a known period', () => {
    expect(
      scopeOf(new URLSearchParams('project=%2Fwork%2Fapp&period=7d&state=x')),
    ).toEqual(both);
  });

  it('drops an unknown period and an empty project', () => {
    expect(scopeOf(new URLSearchParams('project=&period=year'))).toEqual(none);
  });
});

describe('session links', () => {
  it('opens a session with the project and the period', () => {
    expect(sessionHref('a/b', both)).toBe(
      '/sessions/a%2Fb?project=%2Fwork%2Fapp&period=7d',
    );
    expect(sessionHref('s-1', none)).toBe('/sessions/s-1');
  });

  it('goes back to the list with the period and the project', () => {
    expect(sessionsHref(both)).toBe(
      '/sessions?period=7d&project=%2Fwork%2Fapp',
    );
    expect(sessionsHref(none)).toBe('/sessions');
  });

  it('opens the issue page of the session project', () => {
    expect(issueHref(52, '/work/lib', both)).toBe(
      '/features/52?project=%2Fwork%2Flib&period=7d',
    );
    expect(issueHref(52, '/work/lib', none)).toBe(
      '/features/52?project=%2Fwork%2Flib',
    );
  });

  it('opens the bug page of a bug', () => {
    expect(issueHref(52, '/work/lib', both, 'bug')).toBe(
      '/bugs/52?project=%2Fwork%2Flib&period=7d',
    );
    expect(issueHref(52, '/work/lib', none, 'bug')).toBe(
      '/bugs/52?project=%2Fwork%2Flib',
    );
    expect(issueHref(52, '/work/lib', both, 'feature')).toBe(
      '/features/52?project=%2Fwork%2Flib&period=7d',
    );
  });

  it('opens the skill page with the period and the project', () => {
    expect(skillHref('kit:write-spec', both)).toBe(
      '/skills/kit%3Awrite-spec?period=7d&project=%2Fwork%2Fapp',
    );
    expect(skillHref('kit:a', none)).toBe('/skills/kit%3Aa');
  });
});
