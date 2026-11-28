// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App.tsx';
import { loaders } from './app-fixtures.ts';
import {
  connectionsLoaderOf,
  connectionsResponse,
  disconnectAnswer,
  someConnections,
} from './cli-connections-fixtures.ts';

const GRACE = {
  id: 2,
  email: 'grace@example.test',
  name: 'Grace Hopper',
  role: 'dev',
} as const;

afterEach(() => {
  cleanup();
});

describe('the CLI connections page', () => {
  it('opens from the account menu, for a dev too', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App
          {...loaders}
          loadAuthState={() => Promise.resolve({ setup: false })}
          loadMe={() => Promise.resolve({ status: 'account', account: GRACE })}
          signOut={() => Promise.resolve({ status: 'signed-out' })}
          loadCliConnections={connectionsLoaderOf(
            connectionsResponse(someConnections),
          )}
          disconnectCliConnection={disconnectAnswer({ status: 'disconnected' })}
        />
      </MemoryRouter>,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Account: Grace Hopper, Dev' }),
    );
    fireEvent.click(screen.getByRole('link', { name: 'CLI connections' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'CLI connections' }),
    ).toBeDefined();
    const table = await screen.findByRole('table', { name: 'CLI connections' });
    expect(within(table).getByText('ada-laptop')).toBeDefined();
    expect(screen.getByText('3 machines')).toBeDefined();
    expect(
      screen
        .getByRole('button', { name: 'Account: Grace Hopper, Dev' })
        .getAttribute('aria-expanded'),
    ).toBe('false');
  });
});
