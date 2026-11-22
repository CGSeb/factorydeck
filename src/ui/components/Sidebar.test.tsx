// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/react';
import type { Window as HappyWindow } from 'happy-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar.tsx';
import { SIDEBAR_KEY, readFold } from './sidebar-state.ts';

const links = [
  { label: 'Overview', icon: 'overview', href: '#overview', current: true },
  { label: 'Roles', icon: 'roles', href: '#roles', current: false },
] as const;

function setWidth(width: number): void {
  (window as unknown as HappyWindow).happyDOM.setViewport({
    width,
    height: 800,
  });
}

describe('readFold', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts expanded when the key is missing', () => {
    expect(readFold()).toBe('expanded');
  });

  it('restores a kept collapsed or expanded choice', () => {
    window.localStorage.setItem(SIDEBAR_KEY, 'collapsed');
    expect(readFold()).toBe('collapsed');
    window.localStorage.setItem(SIDEBAR_KEY, 'expanded');
    expect(readFold()).toBe('expanded');
  });

  it.each(['', 'Collapsed', ' collapsed', 'folded', 'true'])(
    'starts expanded when the key holds %j',
    (value) => {
      window.localStorage.setItem(SIDEBAR_KEY, value);
      expect(readFold()).toBe('expanded');
    },
  );

  it('starts expanded when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(readFold()).toBe('expanded');
  });
});

describe('Sidebar across the 768 px breakpoint', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    setWidth(1024);
  });

  it('shows the sidebar from 768 px and the menu bar below', () => {
    setWidth(768);
    render(<Sidebar links={links} />);
    expect(screen.getByRole('complementary')).toBeDefined();
    expect(
      screen.queryByRole('button', { name: 'Open navigation' }),
    ).toBeNull();
    cleanup();
    setWidth(767);
    render(<Sidebar links={links} />);
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Open navigation' }),
    ).toBeDefined();
  });

  it('closes the drawer and shows the kept fold when the window grows', () => {
    window.localStorage.setItem(SIDEBAR_KEY, 'collapsed');
    setWidth(360);
    render(<Sidebar links={links} />);
    act(() => {
      screen.getByRole('button', { name: 'Open navigation' }).click();
    });
    expect(screen.getByRole('complementary').getAttribute('data-folded')).toBe(
      'false',
    );
    act(() => {
      setWidth(1280);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('complementary').getAttribute('data-folded')).toBe(
      'true',
    );
  });

  it('keeps folding when localStorage cannot be written', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    render(<Sidebar links={links} />);
    act(() => {
      screen.getByRole('button', { name: 'Collapse sidebar' }).click();
    });
    expect(screen.getByRole('complementary').getAttribute('data-folded')).toBe(
      'true',
    );
  });
});
