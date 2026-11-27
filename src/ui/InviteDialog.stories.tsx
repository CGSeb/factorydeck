import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { DATABASE_UNREACHABLE } from './auth-api.ts';
import { STORY_ORIGIN, createdInvitation } from './invitation-fixtures.ts';
import type { InviteOutcome } from './invitations-api.ts';
import {
  CANCEL,
  CREATE_INVITATION,
  CREATING,
  INVITE_TITLE,
  InviteDialog,
} from './InviteDialog.tsx';

function answering(outcome: InviteOutcome): () => Promise<InviteOutcome> {
  return () => Promise.resolve(outcome);
}

const meta = {
  component: InviteDialog,
  args: {
    view: { kind: 'form' },
    origin: STORY_ORIGIN,
    invite: fn(
      answering({ status: 'created', invitation: createdInvitation() }),
    ),
    onCreated: fn(),
    onClose: fn(),
    copy: fn(() => Promise.resolve()),
  },
} satisfies Meta<typeof InviteDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

async function submit(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  await userEvent.type(canvas.getByLabelText('Email'), 'hal@example.test');
  await userEvent.click(
    canvas.getByRole('button', { name: CREATE_INVITATION }),
  );
}

export const InviteForm: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('dialog', { name: INVITE_TITLE }),
    ).toBeVisible();
    await waitFor(() => expect(canvas.getByLabelText('Email')).toHaveFocus());
    const role = canvas.getByLabelText('Role');
    await expect(role).toHaveValue('dev');
    await expect(
      [...role.querySelectorAll('option')].map((option) => option.textContent),
    ).toEqual(['Dev', 'Manager']);
    await userEvent.selectOptions(role, 'manager');
    await submit(canvasElement);
    await waitFor(() =>
      expect(args.onCreated).toHaveBeenCalledWith(createdInvitation()),
    );
    await expect(args.invite).toHaveBeenCalledWith({
      email: 'hal@example.test',
      role: 'manager',
    });
    await userEvent.click(canvas.getByRole('button', { name: CANCEL }));
    await expect(args.onClose).toHaveBeenCalled();
  },
};

export const Creating: Story = {
  args: { invite: fn(() => new Promise<InviteOutcome>(() => undefined)) },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await submit(canvasElement);
    const button = await canvas.findByRole('button', { name: CREATING });
    await expect(button).toBeDisabled();
    await userEvent.type(canvas.getByLabelText('Email'), '{Enter}');
    await expect(args.invite).toHaveBeenCalledTimes(1);
  },
};

export const Refusal: Story = {
  args: {
    invite: fn(
      answering({
        status: 'invalid',
        field: 'email',
        message: 'This email already has an account',
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await submit(canvasElement);
    const email = canvas.getByLabelText('Email');
    await waitFor(() =>
      expect(email).toHaveAccessibleDescription(
        'This email already has an account',
      ),
    );
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    await expect(email).toHaveFocus();
    await expect(
      canvas.getByRole('dialog', { name: INVITE_TITLE }),
    ).toBeVisible();
  },
};

export const Unreachable: Story = {
  args: {
    invite: fn(answering({ status: 'failed', message: DATABASE_UNREACHABLE })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await submit(canvasElement);
    await expect(await canvas.findByText(DATABASE_UNREACHABLE)).toBeVisible();
    await expect(canvas.getByLabelText('Email')).toHaveValue(
      'hal@example.test',
    );
  },
};
