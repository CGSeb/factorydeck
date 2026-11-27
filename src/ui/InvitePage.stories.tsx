import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { DATABASE_UNREACHABLE, SERVER_UNREACHABLE } from './auth-api.ts';
import {
  NEW_ACCOUNT,
  PENDING_READ,
  STORY_TOKEN,
  accepterOf,
  pendingAccepter,
  pendingReader,
  readerOf,
  readerSequence,
} from './invitation-fixtures.ts';
import {
  CREATE_ACCOUNT,
  CREATING_ACCOUNT,
  DEAD_INVITATION,
  InvitePage,
  JOIN_TITLE,
  PASSWORD_HINT,
  signedInLine,
} from './InvitePage.tsx';

const meta = {
  component: InvitePage,
  args: {
    token: STORY_TOKEN,
    readInvitation: fn(readerOf(PENDING_READ)),
    acceptInvitation: fn(
      accepterOf({ status: 'created', account: NEW_ACCOUNT }),
    ),
    onCreated: fn(),
  },
} satisfies Meta<typeof InvitePage>;

export default meta;

type Story = StoryObj<typeof meta>;

async function fillAndSubmit(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  await userEvent.type(await canvas.findByLabelText('Name'), 'Hal');
  await userEvent.type(
    canvas.getByLabelText('Password'),
    'a long passphrase{Enter}',
  );
}

function formError(canvasElement: HTMLElement): HTMLElement | null {
  return canvasElement.querySelector('.fd-setup-form-error');
}

export const InvitationScreen: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole('heading', { level: 1, name: JOIN_TITLE }),
    ).toBeVisible();
    await expect(canvas.getByText('hal@example.test')).toBeVisible();
    await expect(canvas.queryByRole('navigation')).toBeNull();
    await expect(canvas.queryByText(/You are signed in/)).toBeNull();
    await waitFor(() => expect(canvas.getByLabelText('Name')).toHaveFocus());
    await expect(canvas.getByLabelText('Password')).toHaveAttribute(
      'autocomplete',
      'new-password',
    );
    await expect(canvas.getByText(PASSWORD_HINT)).toBeVisible();
    const username = canvasElement.querySelector('input[name="username"]');
    await expect(username).toHaveAttribute('autocomplete', 'username');
    await expect(username).toHaveValue('hal@example.test');
    await expect(username).not.toBeVisible();
    await fillAndSubmit(canvasElement);
    await waitFor(() => expect(args.onCreated).toHaveBeenCalled());
    await expect(args.readInvitation).toHaveBeenCalledWith(STORY_TOKEN);
    await expect(args.acceptInvitation).toHaveBeenCalledWith({
      token: STORY_TOKEN,
      name: 'Hal',
      password: 'a long passphrase',
    });
  },
};

export const SignedIn: Story = {
  args: { signedInAs: 'Ada' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(signedInLine('Ada'))).toBeVisible();
    await expect(
      canvas.getByText(
        'You are signed in as Ada. Creating this account signs you out.',
      ),
    ).toBeVisible();
  },
};

export const Sending: Story = {
  args: { acceptInvitation: fn(pendingAccepter()) },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await fillAndSubmit(canvasElement);
    const button = await canvas.findByRole('button', {
      name: CREATING_ACCOUNT,
    });
    await expect(button).toBeDisabled();
    await userEvent.type(canvas.getByLabelText('Password'), '{Enter}');
    await expect(args.acceptInvitation).toHaveBeenCalledTimes(1);
  },
};

export const InvalidField: Story = {
  args: {
    acceptInvitation: fn(
      accepterOf({
        status: 'invalid',
        field: 'password',
        message: 'Password must be at least 12 characters',
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await fillAndSubmit(canvasElement);
    const password = canvas.getByLabelText('Password');
    await waitFor(() => expect(password).toHaveFocus());
    await expect(password).toHaveAttribute('aria-invalid', 'true');
    await expect(password).toHaveAccessibleDescription(
      `${PASSWORD_HINT} Password must be at least 12 characters`,
    );
    await expect(canvas.getByLabelText('Name')).toHaveValue('Hal');
  },
};

export const ReadingTheInvitation: Story = {
  args: { readInvitation: fn(pendingReader()) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('heading')).toBeNull();
    await expect(canvas.queryByRole('textbox')).toBeNull();
    await expect(canvas.queryByRole('button')).toBeNull();
    await expect(canvas.getByRole('status')).toHaveClass('fd-visually-hidden');
  },
};

export const DatabaseUnreachable: Story = {
  args: {
    readInvitation: fn(
      readerSequence([
        { status: 'unreachable', message: DATABASE_UNREACHABLE },
        PENDING_READ,
      ]),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      DATABASE_UNREACHABLE,
    );
    await expect(canvas.queryByText(DEAD_INVITATION)).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Retry' }));
    await expect(
      await canvas.findByRole('heading', { level: 1, name: JOIN_TITLE }),
    ).toBeVisible();
  },
};

export const ServerUnreachable: Story = {
  args: {
    readInvitation: fn(
      readerOf({ status: 'unreachable', message: SERVER_UNREACHABLE }),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      SERVER_UNREACHABLE,
    );
    await expect(canvas.getByRole('button', { name: 'Retry' })).toBeVisible();
  },
};

export const LinkNoLongerWorks: Story = {
  args: { readInvitation: fn(readerOf({ status: 'dead' })) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(DEAD_INVITATION)).toBeVisible();
    await expect(canvas.queryByRole('textbox')).toBeNull();
    await expect(canvas.queryByRole('button')).toBeNull();
  },
};

export const LinkDiesOnSubmit: Story = {
  args: { acceptInvitation: fn(accepterOf({ status: 'dead' })) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await fillAndSubmit(canvasElement);
    await expect(await canvas.findByText(DEAD_INVITATION)).toBeVisible();
    await expect(canvas.queryByLabelText('Name')).toBeNull();
  },
};

export const UnreachableOnSubmit: Story = {
  args: {
    acceptInvitation: fn(
      accepterOf({ status: 'failed', message: DATABASE_UNREACHABLE }),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await fillAndSubmit(canvasElement);
    await waitFor(() =>
      expect(formError(canvasElement)).toHaveTextContent(DATABASE_UNREACHABLE),
    );
    await expect(canvas.getByLabelText('Name')).toHaveValue('Hal');
    await expect(canvas.getByLabelText('Password')).toHaveValue(
      'a long passphrase',
    );
    await expect(
      canvas.getByRole('button', { name: CREATE_ACCOUNT }),
    ).toHaveFocus();
  },
};
