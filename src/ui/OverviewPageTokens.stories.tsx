import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { OverviewPage } from './OverviewPage.tsx';
import {
  UNREACHABLE,
  UNREACHABLE_TEXT,
  address,
  headlineLoaded,
  overviewArgs,
  overviewRouter,
} from './overview-story.ts';

const meta = {
  component: OverviewPage,
  args: overviewArgs,
  decorators: [overviewRouter],
} satisfies Meta<typeof OverviewPage>;

export default meta;

type Story = StoryObj<typeof meta>;

async function openDialog(canvasElement: HTMLElement): Promise<HTMLElement> {
  const canvas = within(canvasElement);
  await headlineLoaded(canvasElement);
  await userEvent.click(
    canvas.getByRole('button', { name: 'Where the tokens went' }),
  );
  return canvas.findByRole('dialog', { name: 'Where the tokens went' });
}

async function expectClosed(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull());
  await expect(
    canvas.getByRole('button', { name: 'Where the tokens went' }),
  ).toHaveFocus();
}

export const TokensDialogOpen: Story = {
  name: 'Tokens dialog open',
  play: async ({ canvasElement }) => {
    await headlineLoaded(canvasElement);
    await expect(
      within(canvasElement).getByRole('button', {
        name: 'Where the tokens went',
      }),
    ).toHaveTextContent('12.5M');
    const dialog = await openDialog(canvasElement);
    await expect(
      within(dialog).getByRole('group', { name: 'Tokens by role' }),
    ).toBeVisible();
    await expect(within(dialog).getByText('Tokens per day')).toBeVisible();
    await expect(
      within(dialog).getByRole('link', { name: 'Roles' }),
    ).toHaveAttribute('href', '/roles?period=7d');
    await expect(address(canvasElement)).toHaveTextContent('/?period=7d');
  },
};

export const EscapeCloses: Story = {
  name: 'Escape closes the dialog',
  play: async ({ canvasElement }) => {
    await openDialog(canvasElement);
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
  },
};

export const CloseButtonCloses: Story = {
  name: 'Close button closes the dialog',
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Close' }),
    );
    await expectClosed(canvasElement);
  },
};

export const BackdropCloses: Story = {
  name: 'Backdrop closes the dialog',
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    const backdrop = dialog.parentElement;
    if (backdrop === null) throw new Error('No backdrop');
    await userEvent.click(backdrop);
    await expectClosed(canvasElement);
  },
};

export const TokensDialogToday: Story = {
  name: 'Tokens dialog, today',
  parameters: { entry: '/?period=today' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await headlineLoaded(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Where the tokens went' }),
    );
    const dialog = await canvas.findByRole('dialog');
    await expect(within(dialog).getByText('Tokens per hour')).toBeVisible();
  },
};

export const TokensDialogRolesUnreachable: Story = {
  name: 'Tokens dialog, roles unreachable',
  args: { loadRoles: () => Promise.resolve(UNREACHABLE) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await headlineLoaded(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Where the tokens went' }),
    );
    const dialog = await canvas.findByRole('dialog');
    await expect(within(dialog).getByText(UNREACHABLE_TEXT)).toBeVisible();
  },
};
