import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
  STORY_ORIGIN,
  STORY_TOKEN,
  createdInvitation,
} from './invitation-fixtures.ts';
import {
  COPIED,
  COPY_FAILED,
  COPY_LINK,
  DONE,
  InviteDialog,
  LINK_TITLE,
} from './InviteDialog.tsx';

const LINK = `${STORY_ORIGIN}/invite/${STORY_TOKEN}`;

const meta = {
  title: 'InviteDialog/Link',
  component: InviteDialog,
  args: {
    view: { kind: 'link', invitation: createdInvitation() },
    origin: STORY_ORIGIN,
    invite: fn(() => new Promise<never>(() => undefined)),
    onCreated: fn(),
    onClose: fn(),
    copy: fn(() => Promise.resolve()),
  },
} satisfies Meta<typeof InviteDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const InvitationJustCreated: Story = {
  args: { view: { kind: 'link', invitation: createdInvitation() } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('dialog', { name: LINK_TITLE }),
    ).toBeVisible();
    await expect(canvas.getByLabelText('Link')).toHaveValue(LINK);
    await expect(canvas.getByText(/hal@example\.test/)).toBeVisible();
    const copy = canvas.getByRole('button', { name: COPY_LINK });
    await waitFor(() => expect(copy).toHaveFocus());
    await userEvent.click(copy);
    await expect(args.copy).toHaveBeenCalledWith(LINK);
    await expect(
      await canvas.findByRole('button', { name: COPIED }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: DONE }));
    await expect(args.onClose).toHaveBeenCalled();
  },
};

export const CopyFailed: Story = {
  args: {
    view: { kind: 'link', invitation: createdInvitation() },
    copy: fn(() => Promise.reject(new Error('denied'))),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: COPY_LINK }));
    await expect(
      await canvas.findByRole('button', { name: COPY_FAILED }),
    ).toBeVisible();
    const input = canvas.getByLabelText<HTMLInputElement>('Link');
    await expect(input).toHaveFocus();
    await expect(input.selectionStart).toBe(0);
    await expect(input.selectionEnd).toBe(LINK.length);
  },
};
