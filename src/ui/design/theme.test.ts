// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contrastRatio } from '../colors.ts';
import {
  DARK_QUERY,
  THEME_KEY,
  applyTheme,
  nextTheme,
  readTheme,
  resolveTheme,
  writeTheme,
} from './theme.ts';
import { colorTokens, parseTokens, tokenValues } from './tokens.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const light = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8');
const dark = readFileSync(join(import.meta.dirname, 'theme-dark.css'), 'utf8');
const darkTokens = tokenValues(dark);

function token(name: string): string {
  const value = darkTokens.get(name);
  if (value === undefined) throw new Error(`${name} is not defined`);
  return value;
}

const PAIRS: [text: string, background: string][] = [
  ['--fd-success', '--fd-success-bg'],
  ['--fd-warning', '--fd-warning-bg'],
  ['--fd-info', '--fd-info-bg'],
  ['--fd-danger', '--fd-danger-bg'],
  ['--fd-danger', '--fd-surface-2'],
  ['--fd-neutral', '--fd-neutral-bg'],
  ['--fd-banner-ink', '--fd-warning-bg'],
  ['--fd-accent-ink', '--fd-accent-soft'],
  ...['--fd-ink', '--fd-ink-2', '--fd-muted'].flatMap((text) =>
    ['--fd-page', '--fd-surface', '--fd-surface-2'].map(
      (background): [string, string] => [text, background],
    ),
  ),
  ['--fd-link', '--fd-surface'],
  ['--fd-link', '--fd-surface-2'],
  ['--fd-surface', '--fd-ink'],
  ['--fd-surface', '--fd-danger-strong'],
  ['--fd-tooltip-ink', '--fd-tooltip-bg'],
  ['--fd-tooltip-muted', '--fd-tooltip-bg'],
];

function mockDark(matches: boolean): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: query === DARK_QUERY && matches,
        media: query,
      }) as MediaQueryList,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('dark theme tokens', () => {
  it('only redefines the colour and shadow tokens, under data-theme="dark"', () => {
    expect(dark.trim()).toMatch(/^:root\[data-theme='dark'\]\s*\{[^}]*\}$/);
    expect(dark).toMatch(/color-scheme:\s*dark;/);
    const expected = [
      ...colorTokens(parseTokens(light)).map(({ name }) => name),
      '--fd-shadow-pop',
      '--fd-shadow-tooltip',
    ].sort();
    expect([...darkTokens.keys()].sort()).toEqual(expected);
    expect(parseTokens(dark)).toHaveLength(expected.length);
  });

  it.each(PAIRS)('%s on %s reaches 4.5:1', (text, background) => {
    expect(
      contrastRatio(token(text), token(background)),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['src/ui/main.tsx', './design/theme-dark.css'],
    ['.storybook/preview.ts', '../src/ui/design/theme-dark.css'],
  ])('is imported once by %s', (file, path) => {
    const source = readFileSync(join(ROOT, file), 'utf8');
    expect(source.split(`import '${path}';`)).toHaveLength(2);
  });
});

describe('theme choice', () => {
  it('cycles system, light, dark', () => {
    expect(nextTheme('system')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('system');
  });

  it('resolves system from the colour scheme of the device', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('keeps light and dark in localStorage and forgets system', () => {
    writeTheme('dark');
    expect(window.localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(readTheme()).toBe('dark');
    writeTheme('system');
    expect(window.localStorage.getItem(THEME_KEY)).toBeNull();
    expect(readTheme()).toBe('system');
  });

  it('reads system from an unknown value or a throwing localStorage', () => {
    window.localStorage.setItem(THEME_KEY, 'sepia');
    expect(readTheme()).toBe('system');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readTheme()).toBe('system');
  });

  it('sets data-theme on the root element', () => {
    mockDark(true);
    applyTheme('system');
    expect(document.documentElement.dataset.theme).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    mockDark(false);
    applyTheme('system');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('is applied before the first paint by index.html, from the same key', () => {
    const html = readFileSync(join(ROOT, 'src/ui/index.html'), 'utf8');
    const head = html.slice(0, html.indexOf('</head>'));
    expect(head).toContain(`localStorage.getItem('${THEME_KEY}')`);
    expect(head).toContain(`matchMedia('${DARK_QUERY}')`);
    expect(head).toContain('document.documentElement.dataset.theme');
  });
});
