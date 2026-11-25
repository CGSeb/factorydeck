import { describe, expect, it } from 'vitest';
import { projectOf, projectTarget, withProject } from './project-param.ts';

describe('projectOf', () => {
  it('reads the project, an empty or missing one meaning all projects', () => {
    expect(projectOf(new URLSearchParams('project=%2Fwork%2Fapp'))).toBe(
      '/work/app',
    );
    expect(projectOf(new URLSearchParams('project='))).toBeUndefined();
    expect(projectOf(new URLSearchParams('period=7d'))).toBeUndefined();
  });

  it('keeps another spelling as it is', () => {
    expect(projectOf(new URLSearchParams('project=%2Fwork%2Fapp%2F'))).toBe(
      '/work/app/',
    );
    expect(projectOf(new URLSearchParams('project=%2FWork%2FApp'))).toBe(
      '/Work/App',
    );
  });
});

describe('withProject', () => {
  it('adds the encoded project, and nothing for all projects', () => {
    expect(withProject('/sessions', '/work/my app')).toBe(
      '/sessions?project=%2Fwork%2Fmy+app',
    );
    expect(withProject('/sessions', undefined)).toBe('/sessions');
  });
});

describe('projectTarget', () => {
  const at = (pathname: string, search = '') => ({ pathname, search });

  it('stays on a list page and keeps its other parameters', () => {
    expect(
      projectTarget(at('/sessions', '?period=30d&state=waiting'), '/work/app'),
    ).toBe('/sessions?period=30d&state=waiting&project=%2Fwork%2Fapp');
    expect(
      projectTarget(
        at('/', '?period=today&project=%2Fwork%2Fapp'),
        '/work/lib',
      ),
    ).toBe('/?period=today&project=%2Fwork%2Flib');
    expect(
      projectTarget(at('/skills/kit%3Aa', '?period=7d'), '/work/app'),
    ).toBe('/skills/kit%3Aa?period=7d&project=%2Fwork%2Fapp');
    expect(projectTarget(at('/roles'), '/work/app')).toBe(
      '/roles?project=%2Fwork%2Fapp',
    );
  });

  it('removes the project for all projects', () => {
    expect(
      projectTarget(
        at('/features', '?period=7d&project=%2Fwork%2Fapp'),
        undefined,
      ),
    ).toBe('/features?period=7d');
    expect(projectTarget(at('/', '?project=%2Fwork%2Fapp'), undefined)).toBe(
      '/',
    );
  });

  it('opens the list from a session or an issue page, keeping only the period', () => {
    expect(projectTarget(at('/sessions/abc', '?period=30d'), '/work/app')).toBe(
      '/sessions?period=30d&project=%2Fwork%2Fapp',
    );
    expect(projectTarget(at('/sessions/abc'), undefined)).toBe('/sessions');
    expect(
      projectTarget(
        at('/features/12', '?project=%2Fwork%2Fapp&period=all'),
        '/work/lib',
      ),
    ).toBe('/features?period=all&project=%2Fwork%2Flib');
    expect(
      projectTarget(
        at('/features/12', '?project=%2Fwork%2Fapp&period=all'),
        undefined,
      ),
    ).toBe('/features?period=all');
    expect(
      projectTarget(
        at('/bugs/12', '?project=%2Fwork%2Fapp&period=all'),
        '/work/lib',
      ),
    ).toBe('/bugs?period=all&project=%2Fwork%2Flib');
  });
});
