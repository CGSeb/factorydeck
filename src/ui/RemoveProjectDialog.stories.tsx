import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { RemoveProjectDialog } from './RemoveProjectDialog.tsx';

const meta = {
  component: RemoveProjectDialog,
  args: {
    name: 'Billing',
    sessions: 12,
    state: 'idle',
    onCancel: fn(),
    onConfirm: fn(),
  },
} satisfies Meta<typeof RemoveProjectDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

function backdropOf(canvasElement: HTMLElement): HTMLElement {
  const backdrop = canvasElement.querySelector('.fd-dialog-backdrop');
  if (!(backdrop instanceof HTMLElement)) throw new Error('No backdrop');
  return backdrop;
}

export const WithSessions: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const dialog = canvas.getByRole('dialog', { name: 'Remove Billing?' });
    await expect(dialog).toHaveAccessibleDescription(
      'Its 12 sessions and every figure from them are deleted. A developer who works in this repository again makes it reappear under Remotes not added yet.',
    );
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Remove' })).toHaveFocus();
    await expect(
      canvas.getByRole('button', { name: 'Remove' }),
    ).toHaveAttribute('data-danger', 'true');
    await userEvent.keyboard('{Escape}');
    await expect(args.onCancel).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(args.onCancel).toHaveBeenCalledTimes(2);
    await userEvent.click(backdropOf(canvasElement));
    await expect(args.onCancel).toHaveBeenCalledTimes(3);
    await userEvent.click(canvas.getByRole('button', { name: 'Remove' }));
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
  },
};

export const OneSession: Story = {
  args: { sessions: 1 },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('dialog'),
    ).toHaveAccessibleDescription(
      'Its 1 session and every figure from them are deleted. A developer who works in this repository again makes it reappear under Remotes not added yet.',
    );
  },
};

export const NoSessions: Story = {
  args: { sessions: 0 },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('dialog'),
    ).toHaveAccessibleDescription(
      'It has no sessions. A developer who works in this repository again makes it reappear under Remotes not added yet.',
    );
  },
};

export const Removing: Story = {
  args: { state: 'removing' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Removing…' }),
    ).toBeDisabled();
  },
};

export const Failed: Story = {
  args: { state: 'failed' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(
      'Could not remove Billing. Try again.',
    );
  },
};

export const NotFound: Story = {
  args: { state: 'not-found' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(
      'Billing is no longer in FactoryDeck.',
    );
  },
};
