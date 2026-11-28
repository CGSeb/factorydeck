// @vitest-environment happy-dom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.tsx';
import { loaders } from './app-fixtures.ts';
import type { LoadMe } from './auth-api.ts';
import { LINK_GONE, type ReadReset, type SaveReset } from './reset-api.ts';
import { RESET_TITLE, SAVE_PASSWORD, signedInLine } from './ResetPage.tsx';
import { SIGN_IN_TITLE } from './SignInPage.tsx';

const TOKEN = 'b'.repeat(43);
const ADA = {
  id: 1,
  email: 'ada@example.test',
  name: 'Ada Lovelace',
  role: 'manager',
} as const;
const BOB = {
  id: 2,
  email: 'bob@example.test',
  name: 'Bob Stone',
  role: 'dev',
} as const;

function reader(): ReturnType<typeof vi.fn<ReadReset>> {
  return vi.fn<ReadReset>(() =>
    Promise.resolve({ status: 'ok', email: BOB.email }),
  );
}

function renderApp(
  props: Partial<Parameters<typeof App>[0]>,
  path: string,
): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App
        {...loaders}
        loadAuthState={() => Promise.resolve({ setup: false })}
        signIn={() => Promise.resolve({ status: 'signed-in', account: ADA })}
        signOut={() => Promise.resolve({ status: 'signed-out' })}
        readReset={reader()}
        saveReset={() => Promise.resolve({ status: 'saved', account: BOB })}
        {...props}
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

describe('the reset screen', () => {
  afterEach(() => {
    cleanup();
  });

  it('opens without a session, ignoring the 401 of me, without the sidebar', async () => {
    const readReset = reader();
    renderApp(
      {
        readReset,
        loadMe: () => Promise.resolve({ status: 'signed-out' }),
      },
      `/reset/${TOKEN}`,
    );
    await screen.findByRole('heading', { name: RESET_TITLE });
    await settle();
    expect(screen.queryByRole('heading', { name: SIGN_IN_TITLE })).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.getByText(BOB.email)).toBeDefined();
    expect(readReset).toHaveBeenCalledWith(TOKEN);
  });

  it('warns a signed-in person, then opens / as the reset account', async () => {
    const loadMe = vi.fn<LoadMe>(() =>
      Promise.resolve({ status: 'account', account: ADA }),
    );
    const saveReset = vi.fn<SaveReset>(() =>
      Promise.resolve({ status: 'saved', account: BOB }),
    );
    renderApp({ loadMe, saveReset }, `/reset/${TOKEN}`);
    await screen.findByText(signedInLine(ADA.name));
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'a brand new passphrase' },
    });
    fireEvent.click(screen.getByRole('button', { name: SAVE_PASSWORD }));
    await screen.findByRole('button', { name: 'Account: Bob Stone, Dev' });
    expect(saveReset).toHaveBeenCalledWith(TOKEN, 'a brand new passphrase');
    expect(screen.queryByRole('heading', { name: RESET_TITLE })).toBeNull();
  });

  it.each(['/reset', '/reset/', '/reset/short', `/reset/${TOKEN}/x`])(
    'shows that %s no longer works without asking the server',
    async (path) => {
      const readReset = reader();
      renderApp({ readReset }, path);
      await screen.findByText(LINK_GONE);
      expect(screen.queryByRole('button')).toBeNull();
      expect(readReset).not.toHaveBeenCalled();
    },
  );

  it('shows the unreachable screen when the link cannot be read, and retries', async () => {
    const readReset = vi.fn<ReadReset>();
    readReset.mockResolvedValueOnce({
      status: 'unreachable',
      message: 'Could not reach the server',
    });
    readReset.mockResolvedValue({ status: 'ok', email: BOB.email });
    renderApp({ readReset }, `/reset/${TOKEN}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    await screen.findByRole('heading', { name: RESET_TITLE });
    await waitFor(() => {
      expect(readReset).toHaveBeenCalledTimes(2);
    });
  });
});
