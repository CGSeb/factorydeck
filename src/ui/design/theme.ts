import { useEffect, useState } from 'react';

export const THEME_KEY = 'factorydeck.theme';
export const DARK_QUERY = '(prefers-color-scheme: dark)';

export const THEMES = ['system', 'light', 'dark'] as const;

export type Theme = (typeof THEMES)[number];
export type ResolvedTheme = Exclude<Theme, 'system'>;

export const THEME_LABELS: Record<Theme, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

function isTheme(value: unknown): value is Theme {
  return THEMES.some((theme) => theme === value);
}

export function readTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return isTheme(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function writeTheme(theme: Theme): void {
  try {
    if (theme === 'system') window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    return;
  }
}

export function nextTheme(theme: Theme): Theme {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length] ?? 'system';
}

export function resolveTheme(
  theme: Theme,
  prefersDark: boolean,
): ResolvedTheme {
  if (theme !== 'system') return theme;
  return prefersDark ? 'dark' : 'light';
}

function darkQuery(): MediaQueryList | undefined {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia(DARK_QUERY)
    : undefined;
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = resolveTheme(
    theme,
    darkQuery()?.matches === true,
  );
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return undefined;
    const query = darkQuery();
    if (query === undefined) return undefined;
    function update(): void {
      applyTheme('system');
    }
    query.addEventListener('change', update);
    return () => {
      query.removeEventListener('change', update);
    };
  }, [theme]);
  function cycle(): void {
    const next = nextTheme(theme);
    writeTheme(next);
    setTheme(next);
  }
  return [theme, cycle];
}
