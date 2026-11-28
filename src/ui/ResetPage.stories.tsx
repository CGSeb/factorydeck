import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
  DATABASE_UNREACHABLE,
  SERVER_UNREACHABLE,
  type MeResult,
} from './auth-api.ts';
import {
  LINK_GONE,
  type ResetReadOutcome,
  type ResetSaveOutcome,
} from './reset-api.ts';
import {
  NEW_PASSWORD,
  RESET_TITLE,
  ResetPage,
  SAVE_PASSWORD,
  SAVING,
  signedInLine,
} from './ResetPage.tsx';
import { PASSWORD_HINT } from './SetupPage.tsx';

const TOKEN = 'r'.repeat(43);
const BOB = {
  id: 2,
  email: 'bob@example.test',
  name: 'Bob',
  role: 'dev',
} as const;

function reading(outcome: ResetReadOutcome) {
  return fn(() => Promise.resolve(outcome));
}

function saving(outcome: ResetSaveOutcome) {
  return fn(() => Promise.resolve(outcome));
}

function me(outcome: MeResult): () => Promise<MeResult> {
  return () => Promise.resolve(outcome);
}

const meta = {
  component: ResetPage,
  args: {
    token: TOKEN,
    readReset: reading({ status: 'ok', email: BOB.email }),
    saveReset: saving({ status: 'saved', account: BOB }),
    loadMe: me({ status: 'signed-out' }),
    onSaved: fn(),
  },
} satisfies Meta<typeof ResetPage>;

export default meta;

type Story = StoryObj<typeof meta>;

async function typeAndSubmit(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  const field = await canvas.findByLabelText(NEW_PASSWORD);
  await userEvent.type(field, 'a brand new passphrase{Enter}');
}

function formError(canvasElement: HTMLElement): HTMLElement | null {
  return canvasElement.querySelector('.fd-setup-form-error');
}

export const ResetScreen: Story = {
  name: 'Reset screen',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole('heading', { level: 1, name: RESET_TITLE }),
    ).toBeVisible();
    await expect(canvas.getByText(BOB.email)).toBeVisible();
    await expect(canvas.queryByRole('textbox')).toBeNull();
    await expect(canvas.queryByText(/You are signed in/)).toBeNull();
    const field = canvas.getByLabelText(NEW_PASSWORD);
    await waitFor(() => expect(field).toHaveFocus());
    await expect(field).toHaveAttribute('autocomplete', 'new-password');
    await expect(canvas.getByText(PASSWORD_HINT)).toBeVisible();
    await expect(formError(canvasElement)).toHaveAttribute('role', 'alert');
    await typeAndSubmit(canvasElement);
    await waitFor(() => expect(args.onSaved).toHaveBeenCalledWith(BOB));
    await expect(args.saveReset).toHaveBeenCalledWith(
      TOKEN,
      'a brand new passphrase',
    );
    await expect(args.readReset).toHaveBeenCalledWith(TOKEN);
  },
};

export const SignedIn: Story = {
  name: 'Reset screen while signed in',
  args: {
    loadMe: me({
      status: 'account',
      account: {
        id: 1,
        email: 'ada@example.test',
        name: 'Ada',
        role: 'manager',
      },
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(signedInLine('Ada'))).toBeVisible();
    await expect(canvas.getByText(BOB.email)).toBeVisible();
  },
};

export const Sending: Story = {
  args: {
    saveReset: fn(() => new Promise<ResetSaveOutcome>(() => undefined)),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await canvas.findByLabelText(NEW_PASSWORD);
    const card = canvasElement.querySelector('.fd-setup-card');
    const before = card?.getBoundingClientRect().height;
    await typeAndSubmit(canvasElement);
    const button = await canvas.findByRole('button', { name: SAVING });
    await expect(button).toBeDisabled();
    await userEvent.keyboard('{Enter}');
    await expect(args.saveReset).toHaveBeenCalledOnce();
    await expect(card?.getBoundingClientRect().height).toBe(before);
  },
};

export const InvalidPassword: Story = {
  name: 'Invalid password',
  args: {
    saveReset: saving({
      status: 'invalid',
      message: 'Password must be at least 12 characters',
    }),
    onSaved: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await typeAndSubmit(canvasElement);
    await waitFor(() =>
      expect(formError(canvasElement)).toHaveTextContent(
        'Password must be at least 12 characters',
      ),
    );
    const field = canvas.getByLabelText(NEW_PASSWORD);
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(field).toHaveFocus());
    await expect(field).toHaveAccessibleDescription(
      `${PASSWORD_HINT} Password must be at least 12 characters`,
    );
    await expect(args.onSaved).not.toHaveBeenCalled();
  },
};

export const LinkNoLongerWorks: Story = {
  name: 'Link that no longer works',
  args: { readReset: reading({ status: 'gone' }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(LINK_GONE)).toBeVisible();
    await expect(canvas.queryByRole('button')).toBeNull();
    await expect(canvas.queryByRole('navigation')).toBeNull();
  },
};

export const MalformedToken: Story = {
  name: 'Malformed token: no longer works, nothing asked',
  args: { token: 'short', readReset: reading({ status: 'gone' }) },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(LINK_GONE)).toBeVisible();
    await expect(args.readReset).not.toHaveBeenCalled();
  },
};

export const GoneOnSave: Story = {
  name: 'Link that no longer works on save (410)',
  args: { saveReset: saving({ status: 'gone' }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await typeAndSubmit(canvasElement);
    await expect(await canvas.findByText(LINK_GONE)).toBeVisible();
    await expect(canvas.queryByLabelText(NEW_PASSWORD)).toBeNull();
  },
};

function saveFailed(message: string): Story {
  return {
    args: { saveReset: saving({ status: 'failed', message }), onSaved: fn() },
    play: async ({ canvasElement, args }) => {
      const canvas = within(canvasElement);
      await typeAndSubmit(canvasElement);
      await waitFor(() =>
        expect(formError(canvasElement)).toHaveTextContent(message),
      );
      await expect(canvas.getByLabelText(NEW_PASSWORD)).toHaveValue(
        'a brand new passphrase',
      );
      await expect(canvas.getByLabelText(NEW_PASSWORD)).toHaveAttribute(
        'aria-invalid',
        'false',
      );
      await waitFor(() =>
        expect(
          canvas.getByRole('button', { name: SAVE_PASSWORD }),
        ).toHaveFocus(),
      );
      await expect(args.onSaved).not.toHaveBeenCalled();
    },
  };
}

export const SaveFailedDatabase: Story = {
  name: 'Save failed: database unreachable',
  ...saveFailed(DATABASE_UNREACHABLE),
};

export const SaveFailedNetwork: Story = {
  name: 'Save failed: server unreachable',
  ...saveFailed(SERVER_UNREACHABLE),
};

export const UnreachableOnLoad: Story = {
  name: 'Unreachable while loading',
  args: {
    readReset: reading({
      status: 'unreachable',
      message: DATABASE_UNREACHABLE,
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(DATABASE_UNREACHABLE)).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Retry' })).toHaveFocus();
  },
};
