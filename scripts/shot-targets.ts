import { join } from 'node:path';

export const SHOTS_DIR = 'screenshots';

export type ShotTheme = 'light' | 'dark';

export interface ShotOptions {
  page: string;
  port: string;
  widths: string;
  height: string;
  theme: string;
  out: string | undefined;
}

export interface ShotTarget {
  url: string;
  width: number;
  height: number;
  theme: ShotTheme;
  file: string;
}

function positiveInteger(name: string, value: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`${name} must be a positive integer, not ${value}`);
  }
  return number;
}

function themes(value: string): ShotTheme[] {
  if (value === 'light' || value === 'dark') return [value];
  if (value === 'both') return ['light', 'dark'];
  throw new Error(`--theme must be light, dark or both, not ${value}`);
}

/** Resolves a page path such as `/stats?period=all` against the local server, and keeps a full URL as it is. */
export function pageUrl(page: string, port: number): string {
  if (/^https?:\/\//.test(page)) return page;
  const path = page.startsWith('/') ? page : `/${page}`;
  return `http://127.0.0.1:${String(port)}${path}`;
}

/** Turns a page into a file name: `/stats?period=all` gives `stats-period-all`, `/` gives `home`. */
export function pageSlug(url: string): string {
  const { pathname, search } = new URL(url);
  const slug = `${pathname}${search}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug === '' ? 'home' : slug;
}

/** One screenshot per width and theme asked for. */
export function shotTargets(options: ShotOptions): ShotTarget[] {
  const port = positiveInteger('--port', options.port);
  const height = positiveInteger('--height', options.height);
  const widths = options.widths
    .split(',')
    .map((width) => positiveInteger('--width', width.trim()));
  const url = pageUrl(options.page, port);
  const slug = pageSlug(url);
  const shots = widths.flatMap((width) =>
    themes(options.theme).map((theme) => ({ width, theme })),
  );
  if (options.out !== undefined && shots.length > 1) {
    throw new Error('--out names one file: give a single width and theme');
  }
  return shots.map(({ width, theme }) => ({
    url,
    width,
    height,
    theme,
    file:
      options.out ?? join(SHOTS_DIR, `${slug}-${String(width)}-${theme}.png`),
  }));
}
