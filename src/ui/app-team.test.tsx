// @vitest-environment happy-dom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.tsx';
import { loaders } from './app-fixtures.ts';
import type { LoadMe, MeResult } from './auth-api.ts';
import { aloneManager, teamLoaderOf, teamResponse } from './team-fixtures.ts';

function renderApp(loadMe: LoadMe): void {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App
        {...loaders}
        loadTeam={teamLoaderOf(teamResponse(aloneManager))}
        loadMe={loadMe}
        signOut={() => Promise.resolve({ status: 'signed-out' })}
      />
    </MemoryRouter>,
  );
}

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
  });
}

describe('the Team link', () => {
  afterEach(() => {
    cleanup();
  });

  it('comes from the one me read the account menu uses', async () => {
    const loadMe = vi.fn<LoadMe>(() =>
      Promise.resolve({
        status: 'account',
        account: {
          id: 1,
          email: 'ada@example.test',
          name: 'Ada',
          role: 'manager',
        },
      }),
    );
    renderApp(loadMe);
    const link = await screen.findByRole('link', { name: 'Team' });
    fireEvent.click(link);
    await screen.findByRole('table', { name: 'Team' });
    await settle();
    expect(loadMe).toHaveBeenCalledTimes(1);
  });

  it.each<[string, MeResult]>([
    ['signed out (401)', { status: 'signed-out' }],
    [
      'unreachable (503 or no answer)',
      { status: 'unreachable', message: 'Could not reach the server' },
    ],
  ])('is absent when me answers %s', async (_, result) => {
    renderApp(() => Promise.resolve(result));
    await screen.findByRole('link', { name: 'Roles' });
    await settle();
    expect(screen.queryByRole('link', { name: 'Team' })).toBeNull();
  });
});
