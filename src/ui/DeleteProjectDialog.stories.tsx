import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { DeleteProjectDialog } from './DeleteProjectDialog.tsx';

const meta = {
  component: DeleteProjectDialog,
  args: {
    project: '/home/dev/old-app',
    name: 'Old App',
    sessions: 12,
    state: 'idle',
    onCancel: fn(),
    onConfirm: fn(),
  },
} satisfies Meta<typeof DeleteProjectDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

function backdropOf(canvasElement: HTMLElement): HTMLElement {
  const backdrop = canvasElement.querySelector('.fd-dialog-backdrop');
  if (!(backdrop instanceof HTMLElement)) throw new Error('No backdrop');
  return backdrop;
}

export const Open: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const dialog = canvas.getByRole('dialog', { name: 'Delete Old App?' });
    await expect(
      canvas.getByRole('heading', { name: 'Delete Old App?' }),
    ).toHaveAttribute('title', '/home/dev/old-app');
    await expect(dialog).toHaveTextContent(
      'This removes its 12 sessions and everything FactoryDeck stored about them (sub-agents, API calls, skill launches, prompts). The session logs on disk are not touched. If the factory is installed again in this project, its sessions are read again.',
    );
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.tab();
    await expect(
      canvas.getByRole('button', { name: 'Delete project' }),
    ).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    await expect(
      canvas.getByRole('button', { name: 'Delete project' }),
    ).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await expect(args.onCancel).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(args.onCancel).toHaveBeenCalledTimes(2);
    await userEvent.click(backdropOf(canvasElement));
    await expect(args.onCancel).toHaveBeenCalledTimes(3);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Delete project' }),
    );
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
  },
};

export const Deleting: Story = {
  args: { state: 'deleting' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Deleting…' }),
    ).toBeDisabled();
  },
};

export const Failed: Story = {
  args: { state: 'failed' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(
      'Could not delete Old App. Try again.',
    );
  },
};

export const Refused: Story = {
  args: { state: 'has-factory' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(
      'Old App has its factory configuration again, so it was not deleted.',
    );
  },
};

export const NotFound: Story = {
  args: { state: 'not-found' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(
      'Old App is no longer in FactoryDeck.',
    );
  },
};
