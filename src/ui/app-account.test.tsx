// @vitest-environment happy-dom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.tsx';
import { loaders } from './app-fixtures.ts';
import type { LoadMe, SignOut } from './auth-api.ts';

const ADA = {
  id: 1,
  email: 'ada@example.test',
  name: 'Ada Lovelace',
  role: 'manager',
} as const;

const ACCOUNT_NAME = 'Account: Ada Lovelace, Manager';

function meOf(): ReturnType<typeof vi.fn<LoadMe>> {
  return vi.fn<LoadMe>(() =>
    Promise.resolve({ status: 'account', account: ADA }),
  );
}

function renderApp(
  props: Partial<Parameters<typeof App>[0]>,
  path = '/',
): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App
        {...loaders}
        signOut={() => Promise.resolve({ status: 'signed-out' })}
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

describe('the account read', () => {
  afterEach(() => {
    cleanup();
  });

  it('reads me once when the app opens signed in, across pages', async () => {
    const loadMe = meOf();
    renderApp({
      loadMe,
      loadAuthState: () => Promise.resolve({ setup: false }),
    });
    await screen.findByRole('button', { name: ACCOUNT_NAME });
    const sections = screen.getByRole('navigation', { name: 'Sections' });
    fireEvent.click(within(sections).getByRole('link', { name: 'Stats' }));
    await settle();
    expect(screen.getByRole('button', { name: ACCOUNT_NAME })).toBeDefined();
    expect(loadMe).toHaveBeenCalledTimes(1);
  });

  it('reads me once more after a sign-in, and not again for the menu', async () => {
    const loadMe = vi.fn<LoadMe>();
    loadMe.mockResolvedValueOnce({ status: 'signed-out' });
    loadMe.mockResolvedValue({ status: 'account', account: ADA });
    renderApp(
      {
        loadMe,
        loadAuthState: () => Promise.resolve({ setup: false }),
        signIn: () => Promise.resolve({ status: 'signed-in', account: ADA }),
      },
      '/stats',
    );
    const email = await screen.findByLabelText('Email');
    fireEvent.change(email, { target: { value: ADA.email } });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'a long passphrase' },
    });
    fireEvent.submit(email.closest('form') ?? email);
    await screen.findByRole('button', { name: ACCOUNT_NAME });
    await settle();
    expect(loadMe).toHaveBeenCalledTimes(2);
  });

  it('opens the sign-in screen when the read after setup answers 401', async () => {
    const loadMe = vi.fn<LoadMe>(() =>
      Promise.resolve({ status: 'signed-out' }),
    );
    renderApp(
      {
        loadMe,
        loadAuthState: () => Promise.resolve({ setup: true }),
        setupManager: () => Promise.resolve({ status: 'created' }),
        signIn: () => Promise.resolve({ status: 'signed-in', account: ADA }),
      },
      '/setup',
    );
    const code = await screen.findByLabelText('Setup code');
    fireEvent.submit(code.closest('form') ?? code);
    await screen.findByRole('heading', {
      level: 1,
      name: 'Sign in to FactoryDeck',
    });
    expect(loadMe).toHaveBeenCalledTimes(1);
  });

  it('reads me only once the first manager is created', async () => {
    const loadMe = meOf();
    renderApp(
      {
        loadMe,
        loadAuthState: () => Promise.resolve({ setup: true }),
        setupManager: () => Promise.resolve({ status: 'created' }),
      },
      '/setup',
    );
    const code = await screen.findByLabelText('Setup code');
    await settle();
    expect(loadMe).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /^Account/ })).toBeNull();
    fireEvent.change(code, { target: { value: 'k7mq2xrd' } });
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Ada Lovelace' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: ADA.email },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'a long passphrase' },
    });
    fireEvent.submit(code.closest('form') ?? code);
    await screen.findByRole('button', { name: ACCOUNT_NAME });
    await settle();
    expect(loadMe).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a 401', { status: 'signed-out' }],
    ['a 503', { status: 'unreachable', message: 'Database unreachable' }],
  ] as const)(
    'keeps the placeholder and a closed button after %s',
    async (_case, result) => {
      renderApp({ loadMe: () => Promise.resolve(result) });
      await settle();
      const button = screen.getByRole('button', { name: 'Account' });
      expect(button.hasAttribute('disabled')).toBe(true);
      expect(button.querySelector('[data-placeholder]')).not.toBeNull();
    },
  );
});

describe('signing out', () => {
  afterEach(() => {
    cleanup();
  });

  async function signOutWith(signOut: SignOut): Promise<{
    leavePage: ReturnType<typeof vi.fn<(path: string) => void>>;
  }> {
    const leavePage = vi.fn<(path: string) => void>();
    renderApp({ loadMe: meOf(), signOut, leavePage });
    fireEvent.click(await screen.findByRole('button', { name: ACCOUNT_NAME }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
      await Promise.resolve();
    });
    await settle();
    return { leavePage };
  }

  it('leaves for /sign-in with a full load after a 204', async () => {
    const { leavePage } = await signOutWith(() =>
      Promise.resolve({ status: 'signed-out' }),
    );
    expect(leavePage).toHaveBeenCalledExactlyOnceWith('/sign-in');
  });

  it.each([
    'Database unreachable. Start it with pnpm db:up.',
    'Could not reach the server',
  ])('stays on the page with the menu open on %j', async (message) => {
    const { leavePage } = await signOutWith(() =>
      Promise.resolve({ status: 'failed', message }),
    );
    expect(leavePage).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(message);
    });
    expect(
      screen
        .getByRole('button', { name: ACCOUNT_NAME })
        .getAttribute('aria-expanded'),
    ).toBe('true');
  });
});
