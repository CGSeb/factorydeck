import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { App } from './App.tsx';
import { appArgs, dataCalls, world } from './auth-fixtures.ts';
import { SETUP_TITLE } from './SetupPage.tsx';
import { SIGN_IN_TITLE } from './SignInPage.tsx';

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

async function signIn(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  await canvas.findByRole('heading', { level: 1, name: SIGN_IN_TITLE });
  await userEvent.type(canvas.getByLabelText('Email'), 'ada@example.test');
  await userEvent.type(
    canvas.getByLabelText('Password'),
    'a long passphrase{Enter}',
  );
}

const signedOutLink = world(false);

export const SignedOutLink: Story = {
  name: 'Signed out: a link opens the sign-in screen, then the page',
  parameters: { entries: ['/stats?period=30d&project=x#flow'] },
  beforeEach: () => {
    signedOutLink.reset();
  },
  args: appArgs(signedOutLink),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { level: 1, name: SIGN_IN_TITLE });
    await expect(at(canvasElement)).toHaveTextContent(
      '/sign-in?next=%2Fstats%3Fperiod%3D30d%26project%3Dx%23flow',
    );
    await expect(canvas.queryByRole('navigation')).toBeNull();
    await expect(signedOutLink.calls).toEqual(['state', 'me']);
    await signIn(canvasElement);
    await canvas.findByRole('heading', { level: 1, name: 'Stats' });
    await expect(at(canvasElement)).toHaveTextContent(
      '/stats?period=30d&project=x#flow',
    );
    await expect(signedOutLink.calls.slice(0, 4)).toEqual([
      'state',
      'me',
      'sign-in',
      'me',
    ]);
  },
};

const signedOutHome = world(false);

export const SignedOutHome: Story = {
  name: 'Signed out at /: no next',
  parameters: { entries: ['/'] },
  beforeEach: () => {
    signedOutHome.reset();
  },
  args: appArgs(signedOutHome),
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByRole('heading', {
      level: 1,
      name: SIGN_IN_TITLE,
    });
    await expect(at(canvasElement).textContent).toBe('/sign-in');
  },
};

const expiring = world(true);

export const SessionEnds: Story = {
  name: 'A 401 while open opens the sign-in screen until a sign-in',
  parameters: { entries: ['/'] },
  beforeEach: () => {
    expiring.reset();
  },
  args: appArgs(expiring),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('region', { name: 'Board' });
    expiring.signedIn = false;
    await userEvent.click(canvas.getByRole('link', { name: 'Sessions' }));
    await canvas.findByRole('heading', { level: 1, name: SIGN_IN_TITLE });
    await expect(at(canvasElement).textContent).toBe(
      '/sign-in?next=%2Fsessions',
    );
    const sent = dataCalls(expiring).length;
    await new Promise((resolve) => setTimeout(resolve, 50));
    await expect(dataCalls(expiring)).toHaveLength(sent);
    await signIn(canvasElement);
    await canvas.findByText('3 sessions');
    await expect(at(canvasElement).textContent).toBe('/sessions');
    await expect(dataCalls(expiring).length).toBeGreaterThan(sent);
  },
};

const goingBack = world(false);

export const BackAfterSignIn: Story = {
  name: 'Back after a sign-in skips the sign-in screen',
  parameters: { entries: ['/sessions', '/stats'] },
  beforeEach: () => {
    goingBack.reset();
  },
  args: appArgs(goingBack),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await signIn(canvasElement);
    await canvas.findByRole('heading', { level: 1, name: 'Stats' });
    await userEvent.click(canvas.getByRole('button', { name: 'Back' }));
    await waitFor(() =>
      expect(at(canvasElement).textContent).toBe('/sessions'),
    );
    await canvas.findByText('3 sessions');
  },
};

const signedInNext = world(true);

export const SignedInOpensNext: Story = {
  name: 'Signed in: /sign-in opens next',
  parameters: { entries: ['/sign-in?next=%2Fsessions%3Fperiod%3D7d'] },
  beforeEach: () => {
    signedInNext.reset();
  },
  args: appArgs(signedInNext),
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(at(canvasElement).textContent).toBe('/sessions?period=7d'),
    );
    await expect(within(canvasElement).queryByText(SIGN_IN_TITLE)).toBeNull();
  },
};

const signedInUnsafe = world(true);

export const SignedInUnsafeNext: Story = {
  name: 'Signed in: /sign-in with a next of another site opens /',
  parameters: { entries: ['/sign-in?next=%2F%2Fother.example'] },
  beforeEach: () => {
    signedInUnsafe.reset();
  },
  args: appArgs(signedInUnsafe),
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByRole('region', { name: 'Board' });
    await expect(at(canvasElement).textContent).toBe('/');
  },
};

const notSetUp = world(false, (here) => {
  here.state = () => Promise.resolve({ setup: true });
});

export const SetupDropsNext: Story = {
  name: 'Not set up: /sign-in opens /setup without next',
  parameters: { entries: ['/sign-in?next=%2Fstats'] },
  beforeEach: () => {
    notSetUp.reset();
  },
  args: {
    ...appArgs(notSetUp),
    setupManager: () => new Promise(() => undefined),
  },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByRole('heading', {
      level: 1,
      name: SETUP_TITLE,
    });
    await expect(at(canvasElement).textContent).toBe('/setup');
    await expect(notSetUp.calls).toEqual(['state']);
  },
};
