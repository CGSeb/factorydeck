import type { Decorator } from '@storybook/react-vite';
import { type ReactNode, createElement, useEffect, useState } from 'react';
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test';
import { THEME_KEY } from '../design/theme.ts';
import { NARROW_QUERY, SIDEBAR_KEY } from './sidebar-state.ts';

export function storedFold(): string | null {
  try {
    return window.localStorage.getItem(SIDEBAR_KEY);
  } catch {
    return null;
  }
}

export function storeFold(fold: string | undefined): void {
  try {
    if (fold === undefined) window.localStorage.removeItem(SIDEBAR_KEY);
    else window.localStorage.setItem(SIDEBAR_KEY, fold);
  } catch {
    return;
  }
}

export async function expectFolded(
  canvasElement: HTMLElement,
  folded: boolean,
): Promise<void> {
  const canvas = within(canvasElement);
  await expect(canvas.getByRole('complementary')).toHaveAttribute(
    'data-folded',
    String(folded),
  );
  await expect(
    canvas.getByRole('button', {
      name: folded ? 'Expand sidebar' : 'Collapse sidebar',
    }),
  ).toHaveAttribute('aria-expanded', String(!folded));
}

export async function foldAndUnfold(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  await expectFolded(canvasElement, false);
  await userEvent.click(
    canvas.getByRole('button', { name: 'Collapse sidebar' }),
  );
  await expectFolded(canvasElement, true);
  await expect(storedFold()).toBe('collapsed');
  await userEvent.click(canvas.getByRole('button', { name: 'Expand sidebar' }));
  await expectFolded(canvasElement, false);
  await expect(storedFold()).toBe('expanded');
}

function insideDrawer(): boolean {
  const drawer = document.querySelector('[role="dialog"]');
  return drawer !== null && drawer.contains(document.activeElement);
}

export async function tabStaysInDrawer(): Promise<void> {
  const drawer = document.querySelector('[role="dialog"]');
  if (drawer === null) throw new Error('The drawer is not open');
  const stops = drawer.querySelectorAll('a[href], button:not(:disabled)');
  for (let step = 0; step <= stops.length; step += 1) {
    await userEvent.tab();
    await expect(insideDrawer()).toBe(true);
  }
  await userEvent.tab({ shift: true });
  await expect(insideDrawer()).toBe(true);
}

export async function openDrawer(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  const menu = canvas.getByRole('button', { name: 'Open navigation' });
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(
    canvas.queryByRole('button', { name: /sidebar$/ }),
  ).not.toBeInTheDocument();
  await userEvent.click(menu);
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  const drawer = canvas.getByRole('dialog', { name: 'Navigation' });
  await expect(menu).toHaveAttribute('aria-controls', drawer.id);
  await waitFor(() =>
    expect(
      within(drawer).getByRole('button', { name: 'Close navigation' }),
    ).toHaveFocus(),
  );
}

export async function expectDrawerClosed(
  canvasElement: HTMLElement,
): Promise<void> {
  const canvas = within(canvasElement);
  await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull());
  await expect(
    canvas.getByRole('button', { name: 'Open navigation' }),
  ).toHaveFocus();
}

function StoredFold({
  fold,
  children,
}: {
  fold: string | undefined;
  children: ReactNode;
}): ReactNode {
  useState(() => {
    storeFold(fold);
    return fold;
  });
  useEffect(
    () => () => {
      storeFold(undefined);
    },
    [],
  );
  return children;
}

export function withStoredFold(fold: string | undefined): Decorator {
  return (Story) =>
    createElement(StoredFold, { fold, children: createElement(Story) });
}

export function currentLinks(canvasElement: HTMLElement): string[] {
  const nav = within(canvasElement).getByRole('navigation', {
    name: 'Sections',
  });
  return within(nav)
    .getAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'page')
    .map((link) => link.textContent);
}

export async function peek(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  await userEvent.click(
    canvas.getByRole('button', { name: 'Project: All projects' }),
  );
  await expect(
    canvas.getByRole('combobox', { name: 'Project' }),
  ).toHaveAttribute('aria-expanded', 'true');
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function tapLabelWhilePeeked(
  canvasElement: HTMLElement,
  label: string,
): Promise<void> {
  const target = within(canvasElement).getByText(label);
  await fireEvent.pointerDown(target);
  await pause(50);
  await expectFolded(canvasElement, false);
  await fireEvent.pointerUp(target);
  await pause(100);
  await expectFolded(canvasElement, false);
  await fireEvent.click(target);
}

export function storedTheme(): string | null {
  try {
    return window.localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function forgetTheme(): void {
  try {
    window.localStorage.removeItem(THEME_KEY);
  } catch {
    return;
  }
  delete document.documentElement.dataset.theme;
}

function ForgottenTheme({ children }: { children: ReactNode }): ReactNode {
  useState(forgetTheme);
  useEffect(() => forgetTheme, []);
  return children;
}

export const withoutStoredTheme: Decorator = (Story) =>
  createElement(ForgottenTheme, { children: createElement(Story) });

export async function cycleThemes(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  const root = document.documentElement;
  await expect(storedTheme()).toBeNull();
  await expect(['light', 'dark']).toContain(root.dataset.theme);
  await userEvent.click(canvas.getByRole('button', { name: 'Theme: System' }));
  await expect(root).toHaveAttribute('data-theme', 'light');
  await expect(storedTheme()).toBe('light');
  await userEvent.click(canvas.getByRole('button', { name: 'Theme: Light' }));
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect(storedTheme()).toBe('dark');
  await userEvent.click(canvas.getByRole('button', { name: 'Theme: Dark' }));
  await expect(
    canvas.getByRole('button', { name: 'Theme: System' }),
  ).toBeInTheDocument();
  await expect(storedTheme()).toBeNull();
}

export const SECTION_PATHS = [
  '/',
  '/features',
  '/stats',
  '/frictions',
  '/sessions',
  '/skills',
  '/roles',
];

function NarrowWindow({ children }: { children: ReactNode }): ReactNode {
  const [original] = useState(() => {
    const matchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query) =>
      matchMedia(query === NARROW_QUERY ? '(min-width: 0px)' : query);
    return matchMedia;
  });
  useEffect(
    () => () => {
      window.matchMedia = original;
    },
    [original],
  );
  return createElement('div', { style: { maxWidth: 360 } }, children);
}

export const inNarrowWindow: Decorator = (Story) =>
  createElement(NarrowWindow, { children: createElement(Story) });
