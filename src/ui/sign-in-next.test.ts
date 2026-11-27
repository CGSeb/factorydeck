import { describe, expect, it } from 'vitest';
import { nextOf, safeNext, signInPath } from './sign-in-next.ts';

describe('next', () => {
  it.each([
    '/sessions?period=7d',
    '/stats?period=30d&project=x#flow',
    '/features/12',
    '/sign-in-help',
    '/apis',
  ])('keeps %s', (path) => {
    expect(nextOf(`?next=${encodeURIComponent(path)}`)).toBe(path);
  });

  it.each([
    'https://other.example',
    '//other.example',
    '/\\other.example',
    '/sign-in',
    '/sign-in?next=%2Fstats',
    '/sign-in/',
    '/Sign-In',
    '/setup',
    '/setup#top',
    '/api/overview',
    '/api/',
    '/api/?x=1',
    '/api//',
    '/API/overview',
    'stats',
    '',
  ])('opens / for %s', (path) => {
    expect(nextOf(`?next=${encodeURIComponent(path)}`)).toBe('/');
  });

  it('opens / without next', () => {
    expect(nextOf('')).toBe('/');
    expect(safeNext(null)).toBe('/');
  });

  it('uses the first of two next values', () => {
    expect(nextOf('?next=%2Fstats&next=%2Fsessions')).toBe('/stats');
    expect(nextOf('?next=%2F%2Fother.example&next=%2Fsessions')).toBe('/');
  });

  it('reads a next written with its & and hash encoded', () => {
    expect(nextOf('?next=%2Fstats%3Fperiod%3D30d%26project%3Dx%23flow')).toBe(
      '/stats?period=30d&project=x#flow',
    );
  });
});

describe('sign-in path', () => {
  it('encodes the page asked for as a query value', () => {
    expect(signInPath('/sessions?period=7d')).toBe(
      '/sign-in?next=%2Fsessions%3Fperiod%3D7d',
    );
    expect(signInPath('/stats?period=30d&project=x#flow')).toBe(
      '/sign-in?next=%2Fstats%3Fperiod%3D30d%26project%3Dx%23flow',
    );
  });

  it.each(['/', '/setup', '/sign-in', '/sign-in?next=%2Fstats'])(
    'leaves next out for %s',
    (path) => {
      expect(signInPath(path)).toBe('/sign-in');
    },
  );
});
