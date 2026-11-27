import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { someTeam } from './team-fixtures.ts';
import {
  DONE,
  RESET_ACTION,
  ResetLinkPanel,
  VALID_FOR,
} from './ResetLinkPanel.tsx';
import { COPIED, COPY_FAILED, COPY_LINK } from './invite-dialog-state.ts';

const DARA = someTeam.find(({ name }) => name === 'Dara');
if (DARA === undefined) throw new Error('No Dara');
const TOKEN = 'd'.repeat(43);

const meta = {
  component: ResetLinkPanel,
  args: {
    account: DARA,
    link: { token: TOKEN, expiresAt: '2026-03-13T15:30:00.000Z' },
    origin: 'https://deck.example.test',
    copy: fn(() => Promise.resolve()),
    onDone: fn(),
  },
} satisfies Meta<typeof ResetLinkPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Created: Story = {
  name: 'Link just created',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole('group', {
      name: `${RESET_ACTION} for Dara`,
    });
    await expect(group).toHaveTextContent(VALID_FOR);
    await expect(
      canvas.getByRole('textbox', { name: RESET_ACTION }),
    ).toHaveValue(`https://deck.example.test/reset/${TOKEN}`);
    await expect(canvas.getByRole('button', { name: COPY_LINK })).toHaveFocus();
    await userEvent.click(canvas.getByRole('button', { name: DONE }));
    await expect(args.onDone).toHaveBeenCalledOnce();
  },
};

export const Copied: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: COPY_LINK }));
    await canvas.findByRole('button', { name: COPIED });
  },
};

export const CopyFailed: Story = {
  name: 'Could not copy',
  args: { copy: fn(() => Promise.reject(new Error('denied'))) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: COPY_LINK }));
    await canvas.findByRole('button', { name: COPY_FAILED });
    await expect(
      canvas.getByRole('textbox', { name: RESET_ACTION }),
    ).toHaveFocus();
  },
};
