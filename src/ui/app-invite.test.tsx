// @vitest-environment happy-dom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App, type AppProps } from './App.tsx';
import { loaders } from './app-fixtures.ts';
import type { AuthState, LoadMe } from './auth-api.ts';
import { authGate } from './auth-gate.ts';
import {
  NEW_ACCOUNT,
  PENDING_READ,
  STORY_TOKEN,
  accepterOf,
  readerOf,
} from './invitation-fixtures.ts';
import type { AcceptInvitation, ReadInvitation } from './invitations-api.ts';
import { JOIN_TITLE, signedInLine } from './InvitePage.tsx';

const ADA = {
  id: 1,
  email: 'ada@example.test',
  name: 'Ada',
  role: 'manager',
} as const;

let where = '';
let how = '';

function Probe(): ReactElement | null {
  const location = useLocation();
  const type = useNavigationType();
  where = `${location.pathname}${location.search}`;
  how = type;
  return null;
}

interface Options {
  state?: AuthState;
  loadMe?: LoadMe;
  readInvitation?: ReadInvitation;
  acceptInvitation?: AcceptInvitation;
}

function renderInvite(options: Options = {}) {
  const loadOverview = vi.fn<AppProps['loadOverview']>(loaders.loadOverview);
  const loadFactory = vi.fn<AppProps['loadFactory']>(loaders.loadFactory);
  const loadMe = vi.fn<LoadMe>(
    options.loadMe ?? (() => Promise.resolve({ status: 'signed-out' })),
  );
  const readInvitation = vi.fn<ReadInvitation>(
    options.readInvitation ?? readerOf(PENDING_READ),
  );
  const acceptInvitation = vi.fn<AcceptInvitation>(
    options.acceptInvitation ??
      accepterOf({ status: 'created', account: NEW_ACCOUNT }),
  );
  render(
    <MemoryRouter initialEntries={[`/invite/${STORY_TOKEN}`]}>
      <Probe />
      <App
        {...loaders}
        loadOverview={loadOverview}
        loadFactory={loadFactory}
        loadAuthState={() => Promise.resolve(options.state ?? { setup: false })}
        setupManager={() => Promise.resolve({ status: 'created' })}
        loadMe={loadMe}
        signIn={() => Promise.resolve({ status: 'refused', message: 'x' })}
        signOut={() => Promise.resolve({ status: 'signed-out' })}
        sessionGate={authGate()}
        readInvitation={readInvitation}
        acceptInvitation={acceptInvitation}
      />
    </MemoryRouter>,
  );
  return {
    loadOverview,
    loadFactory,
    loadMe,
    readInvitation,
    acceptInvitation,
  };
}

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
  });
}

async function fillAndSubmit(): Promise<void> {
  fireEvent.change(await screen.findByLabelText('Name'), {
    target: { value: 'Hal' },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'a long passphrase' },
  });
  fireEvent.submit(screen.getByLabelText('Name').closest('form')!);
}

describe('/invite/<token>', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the invitation screen without a session, skipping the sign-in redirect and every data route', async () => {
    const spies = renderInvite();
    await screen.findByRole('heading', { level: 1, name: JOIN_TITLE });
    expect(where).toBe(`/invite/${STORY_TOKEN}`);
    expect(screen.queryByText(/You are signed in/)).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(spies.loadMe).toHaveBeenCalledTimes(1);
    expect(spies.readInvitation).toHaveBeenCalledWith(STORY_TOKEN);
    expect(spies.loadOverview).not.toHaveBeenCalled();
    expect(spies.loadFactory).not.toHaveBeenCalled();
  });

  it('adds the signed-in line for an account, and opens / replacing the entry after one me read', async () => {
    const loadMe = vi.fn<LoadMe>();
    loadMe.mockResolvedValueOnce({ status: 'account', account: ADA });
    loadMe.mockResolvedValue({ status: 'account', account: NEW_ACCOUNT });
    const spies = renderInvite({ loadMe });
    expect(await screen.findByText(signedInLine('Ada'))).toBeTruthy();
    expect(spies.loadOverview).not.toHaveBeenCalled();
    await fillAndSubmit();
    await settle();
    expect(where).toBe('/');
    expect(how).toBe('REPLACE');
    expect(loadMe).toHaveBeenCalledTimes(2);
    expect(
      await screen.findByRole('button', { name: 'Account: Hal, Dev' }),
    ).toBeTruthy();
  });

  it('opens /setup while setup is true', async () => {
    const spies = renderInvite({ state: { setup: true } });
    await screen.findByRole('heading', {
      level: 1,
      name: 'Set up FactoryDeck',
    });
    expect(where).toBe('/setup');
    expect(spies.readInvitation).not.toHaveBeenCalled();
  });

  it('shows the unreachable screen when the account cannot be read', async () => {
    const spies = renderInvite({
      loadMe: () =>
        Promise.resolve({
          status: 'unreachable',
          message: 'Could not reach the server',
        }),
    });
    await screen.findByRole('button', { name: 'Retry' });
    expect(spies.readInvitation).not.toHaveBeenCalled();
  });
});
