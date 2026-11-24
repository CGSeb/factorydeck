import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pageSlug, pageUrl, shotTargets } from './shot-targets.ts';

const DEFAULTS = {
  page: '/',
  port: '4318',
  widths: '1280',
  height: '900',
  theme: 'light',
  out: undefined,
};

describe('pageUrl', () => {
  it('resolves a path against the local server', () => {
    expect(pageUrl('/stats?period=all', 4320)).toBe(
      'http://127.0.0.1:4320/stats?period=all',
    );
  });

  it('adds the leading slash of a bare path', () => {
    expect(pageUrl('frictions', 4318)).toBe('http://127.0.0.1:4318/frictions');
  });

  it('keeps a full URL', () => {
    expect(pageUrl('http://localhost:6006/?path=/story/x', 4318)).toBe(
      'http://localhost:6006/?path=/story/x',
    );
  });
});

describe('pageSlug', () => {
  it.each([
    ['http://127.0.0.1:4318/', 'home'],
    ['http://127.0.0.1:4318/stats?period=all', 'stats-period-all'],
    ['http://127.0.0.1:4318/issues/Example-App/13', 'issues-example-app-13'],
  ])('names %s %s', (url, slug) => {
    expect(pageSlug(url)).toBe(slug);
  });
});

describe('shotTargets', () => {
  it('takes one shot per width and theme', () => {
    const targets = shotTargets({
      ...DEFAULTS,
      page: '/stats',
      widths: '1024, 2560',
      theme: 'both',
    });
    expect(
      targets.map(({ width, theme, file }) => [width, theme, file]),
    ).toEqual([
      [1024, 'light', join('screenshots', 'stats-1024-light.png')],
      [1024, 'dark', join('screenshots', 'stats-1024-dark.png')],
      [2560, 'light', join('screenshots', 'stats-2560-light.png')],
      [2560, 'dark', join('screenshots', 'stats-2560-dark.png')],
    ]);
  });

  it('writes a single shot to the file given', () => {
    expect(shotTargets({ ...DEFAULTS, out: 'a.png' })).toEqual([
      {
        url: 'http://127.0.0.1:4318/',
        width: 1280,
        height: 900,
        theme: 'light',
        file: 'a.png',
      },
    ]);
  });

  it.each([
    [{ widths: '1280,wide' }, '--width must be a positive integer, not wide'],
    [{ port: '0' }, '--port must be a positive integer, not 0'],
    [{ theme: 'sepia' }, '--theme must be light, dark or both, not sepia'],
    [{ theme: 'both', out: 'a.png' }, '--out names one file'],
  ])('refuses %o', (options, message) => {
    expect(() => shotTargets({ ...DEFAULTS, ...options })).toThrow(message);
  });
});
