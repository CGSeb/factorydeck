import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { App } from './App.tsx';
import {
  DATABASE_UNREACHABLE,
  SERVER_UNREACHABLE,
  type AuthState,
} from './auth-api.ts';
import { appArgs, dataCalls, deferred, world } from './auth-fixtures.ts';
import { SETUP_TITLE } from './SetupPage.tsx';
import { SIGN_IN_TITLE } from './SignInPage.tsx';
import { RETRY, RETRYING } from './UnreachableScreen.tsx';

function Location(): ReactElement {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <p data-testid="location">{`${pathname}${search}${hash}`}</p>
      <button type="button" onClick={() => void navigate(-1)}>
        Back
      </button>
    </>
  );
}

function entriesOf(value: unknown): string[] {
  return Array.isArray(value) &&
    value.every((entry): entry is string => typeof entry === 'string')
    ? value
    : ['/'];
}

const meta = {
  component: App,
  decorators: [
    (Story, { parameters }) => {
      const entries = entriesOf(parameters['entries']);
      return (
        <MemoryRouter
          initialEntries={entries}
          initialIndex={entries.length - 1}
        >
          <Story />
          <Location />
        </MemoryRouter>
      );
    },
  ],
} satisfies Meta<typeof App>;

export default meta;

type Story = StoryObj<typeof meta>;

function at(canvasElement: HTMLElement): HTMLElement {
  return within(canvasElement).getByTestId('location');
}

let stateRetry = deferred<AuthState>();
const stateDown = world(true, (here) => {
  stateRetry = deferred<AuthState>();
  here.state = () => {
    here.state = () => stateRetry.promise;
    return Promise.resolve({ unreachable: DATABASE_UNREACHABLE });
  };
});

export const StateUnreachable: Story = {
  name: 'Unreadable state: the unreachable screen, then Retry',
  parameters: { entries: ['/stats'] },
  beforeEach: () => {
    stateDown.reset();
  },
  args: appArgs(stateDown),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByRole('alert')).toHaveTextContent(DATABASE_UNREACHABLE),
    );
    await expect(canvas.queryByText(SIGN_IN_TITLE)).toBeNull();
    await expect(stateDown.calls).toEqual(['state']);
    await expect(at(canvasElement).textContent).toBe('/stats');
    await userEvent.click(canvas.getByRole('button', { name: RETRY }));
    const retrying = await canvas.findByRole('button', { name: RETRYING });
    await expect(retrying).toHaveAttribute('aria-disabled', 'true');
    await expect(retrying).toHaveFocus();
    await userEvent.click(retrying);
    await expect(stateDown.calls).toEqual(['state', 'state']);
    stateRetry.resolve({ setup: false });
    await canvas.findByRole('heading', { level: 1, name: 'Stats' });
    await expect(at(canvasElement).textContent).toBe('/stats');
  },
};

const meDown = world(false, (here) => {
  here.me = () => {
    here.me = () => Promise.resolve({ status: 'signed-out' });
    return Promise.resolve({
      status: 'unreachable',
      message: SERVER_UNREACHABLE,
    });
  };
});

export const MeUnreachable: Story = {
  name: 'Unreadable account: Retry, then a 401 opens the sign-in screen',
  parameters: { entries: ['/sessions'] },
  beforeEach: () => {
    meDown.reset();
  },
  args: appArgs(meDown),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByRole('alert')).toHaveTextContent(SERVER_UNREACHABLE),
    );
    await expect(meDown.calls).toEqual(['state', 'me']);
    await userEvent.click(canvas.getByRole('button', { name: RETRY }));
    await canvas.findByRole('heading', { level: 1, name: SIGN_IN_TITLE });
    await expect(at(canvasElement).textContent).toBe(
      '/sign-in?next=%2Fsessions',
    );
    await expect(dataCalls(meDown)).toEqual([]);
  },
};

const stillDown = world(true, (here) => {
  here.state = () => {
    here.state = () => Promise.resolve({ unreachable: SERVER_UNREACHABLE });
    return Promise.resolve({ unreachable: DATABASE_UNREACHABLE });
  };
});

export const RetryFails: Story = {
  name: 'Retry that fails keeps the screen with its new message',
  beforeEach: () => {
    stillDown.reset();
  },
  args: appArgs(stillDown),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const retry = await canvas.findByRole('button', { name: RETRY });
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      DATABASE_UNREACHABLE,
    );
    await userEvent.click(retry);
    await waitFor(() =>
      expect(canvas.getByRole('alert')).toHaveTextContent(SERVER_UNREACHABLE),
    );
    await expect(canvas.getByRole('button', { name: RETRY })).toHaveFocus();
    await expect(dataCalls(stillDown)).toEqual([]);
  },
};

const setupOnRetry = world(false, (here) => {
  here.state = () => {
    here.state = () => Promise.resolve({ setup: true });
    return Promise.resolve({ unreachable: SERVER_UNREACHABLE });
  };
});

export const RetryOpensSetup: Story = {
  name: 'Retry while not set up opens /setup',
  parameters: { entries: ['/stats'] },
  beforeEach: () => {
    setupOnRetry.reset();
  },
  args: {
    ...appArgs(setupOnRetry),
    setupManager: () => new Promise(() => undefined),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: RETRY }));
    await canvas.findByRole('heading', { level: 1, name: SETUP_TITLE });
    await expect(at(canvasElement).textContent).toBe('/setup');
  },
};
