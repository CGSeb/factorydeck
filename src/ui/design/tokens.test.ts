import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WHITE, contrastRatio } from '../colors.ts';
import { colorTokens, parseTokens, tokenValues } from './tokens.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const css = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8');
const tokens = tokenValues(css);

const EXPECTED: Record<string, string> = {
  '--fd-ink': '#17201f',
  '--fd-ink-2': '#3c4846',
  '--fd-muted': '#55625f',
  '--fd-page': '#f3f5f4',
  '--fd-surface': '#ffffff',
  '--fd-surface-2': '#f6f8f7',
  '--fd-overlay': 'rgba(16, 24, 23, 0.45)',
  '--fd-shadow-pop':
    '0 1px 2px rgba(16, 24, 23, 0.06), 0 8px 24px rgba(16, 24, 23, 0.12)',
  '--fd-shadow-tooltip': '0 8px 24px rgba(16, 24, 23, 0.18)',
  '--fd-border': '#dfe5e3',
  '--fd-border-2': '#e3e9e7',
  '--fd-line': '#edf1ef',
  '--fd-field-border': '#cfd8d5',
  '--fd-accent': '#0f766e',
  '--fd-accent-soft': '#e3eeeb',
  '--fd-accent-ink': '#0b3f3a',
  '--fd-link': '#0b5f58',
  '--fd-link-hover': '#063f3a',
  '--fd-success-bg': '#e2f3ec',
  '--fd-success': '#14593a',
  '--fd-warning-bg': '#fdf0dc',
  '--fd-warning': '#7d4500',
  '--fd-info-bg': '#e7edf9',
  '--fd-info': '#25438a',
  '--fd-danger-bg': '#fbe6e6',
  '--fd-danger': '#8f1d1d',
  '--fd-neutral-bg': '#eef1f0',
  '--fd-neutral': '#3c4846',
  '--fd-danger-strong': '#a1291f',
  '--fd-banner-border': '#f0d6a8',
  '--fd-banner-ink': '#4d2c00',
  '--fd-stage-ready': '#8a9592',
  '--fd-stage-working': '#2f5fb3',
  '--fd-stage-review': '#c27a12',
  '--fd-stage-merged': '#1f8a5b',
  '--fd-kind-cache-read': '#0f766e',
  '--fd-kind-cache-write': '#5fb3a6',
  '--fd-kind-input': '#b9d8d2',
  '--fd-kind-output': '#17201f',
  '--fd-tooltip-bg': '#17201f',
  '--fd-tooltip-ink': '#ffffff',
  '--fd-tooltip-muted': '#b9c4c1',
  '--fd-tooltip-line': '#3a4644',
  '--fd-font-body': "'Inter Variable', system-ui, sans-serif",
  '--fd-font-display':
    "'Space Grotesk Variable', 'Inter Variable', system-ui, sans-serif",
  '--fd-font-mono': "ui-monospace, 'SFMono-Regular', Menlo, monospace",
  '--fd-text-xs': '12px',
  '--fd-text-sm': '13px',
  '--fd-text-md': '14px',
  '--fd-text-lg': '15px',
  '--fd-title-sm': '18px',
  '--fd-title-md': '28px',
  '--fd-title-lg': '32px',
  '--fd-figure': '40px',
  '--fd-space-1': '4px',
  '--fd-space-2': '8px',
  '--fd-space-3': '12px',
  '--fd-space-4': '16px',
  '--fd-space-5': '20px',
  '--fd-space-6': '24px',
  '--fd-space-7': '28px',
  '--fd-space-8': '32px',
  '--fd-radius-sm': '6px',
  '--fd-radius-card': '10px',
  '--fd-radius-panel': '14px',
  '--fd-radius-aside': '16px',
  '--fd-radius-dialog': '18px',
  '--fd-radius-pill': '999px',
  '--fd-page-max': '1360px',
  '--fd-gutter': '24px',
  '--fd-topbar-height': '60px',
  '--fd-sidebar-width': '232px',
  '--fd-sidebar-collapsed': '64px',
  '--fd-control-height': '40px',
};

function token(name: string): string {
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`${name} is not defined`);
  return value;
}

const PAIRS: [text: string, background: string][] = [
  ['--fd-success', '--fd-success-bg'],
  ['--fd-warning', '--fd-warning-bg'],
  ['--fd-info', '--fd-info-bg'],
  ['--fd-danger', '--fd-danger-bg'],
  ['--fd-neutral', '--fd-neutral-bg'],
  ...['--fd-ink', '--fd-ink-2', '--fd-muted'].flatMap((text) =>
    ['--fd-page', '--fd-surface', '--fd-surface-2'].map(
      (background): [string, string] => [text, background],
    ),
  ),
  ['--fd-link', '--fd-surface'],
  ['--fd-tooltip-ink', '--fd-tooltip-bg'],
  ['--fd-tooltip-muted', '--fd-tooltip-bg'],
];

describe('design tokens', () => {
  it('defines exactly the tokens of spec 014, on :root', () => {
    expect(css.trim()).toMatch(/^:root\s*\{[^}]*\}$/);
    expect(Object.fromEntries(tokens)).toEqual(EXPECTED);
    expect(parseTokens(css)).toHaveLength(Object.keys(EXPECTED).length);
  });

  it('lists the colour tokens', () => {
    const names = colorTokens(parseTokens(css)).map(({ name }) => name);
    expect(names).toContain('--fd-overlay');
    expect(names).toContain('--fd-tooltip-line');
    expect(names).not.toContain('--fd-font-body');
    expect(names).toHaveLength(41);
  });

  it.each(PAIRS)('%s on %s reaches 4.5:1', (text, background) => {
    expect(
      contrastRatio(token(text), token(background)),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['--fd-accent', '--fd-danger-strong'])(
    'white on %s reaches 4.5:1',
    (background) => {
      expect(contrastRatio(WHITE, token(background))).toBeGreaterThanOrEqual(
        4.5,
      );
    },
  );

  it.each([
    ['src/ui/main.tsx', './design/tokens.css'],
    ['.storybook/preview.ts', '../src/ui/design/tokens.css'],
  ])('is imported once by %s, with the fonts', (file, path) => {
    const source = readFileSync(join(ROOT, file), 'utf8');
    for (const module of [
      path,
      '@fontsource-variable/inter',
      '@fontsource-variable/space-grotesk',
    ]) {
      expect(source.split(`import '${module}';`)).toHaveLength(2);
    }
  });
});
