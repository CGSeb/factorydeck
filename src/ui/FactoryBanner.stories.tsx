import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
  archivedLib,
  deleterOf,
  oldApp,
  pendingDeleter,
} from './factory-fixtures.ts';
import { FactoryBanner } from './FactoryBanner.tsx';

const meta = {
  component: FactoryBanner,
  args: {
    missing: [oldApp],
    deleteProject: deleterOf('deleted'),
    onDeleted: fn(),
  },
} satisfies Meta<typeof FactoryBanner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OneProject: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('listitem')).toHaveTextContent(
      'Factory configuration not found for old-app: /home/dev/old-app/docs/agents/factory.yml. Its data is kept, but new sessions are no longer read.Delete project',
    );
    const open = canvas.getByRole('button', { name: 'Delete project' });
    await userEvent.click(open);
    await expect(
      canvas.getByRole('dialog', { name: 'Delete old-app?' }),
    ).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect(canvas.queryByRole('dialog')).toBeNull();
    await expect(open).toHaveFocus();
    await userEvent.click(open);
    const dialog = within(canvas.getByRole('dialog'));
    await userEvent.click(
      dialog.getByRole('button', { name: 'Delete project' }),
    );
    await waitFor(() =>
      expect(args.onDeleted).toHaveBeenCalledWith(oldApp.project),
    );
    await expect(canvas.queryByRole('dialog')).toBeNull();
  },
};

export const TwoProjects: Story = {
  args: { missing: [archivedLib, oldApp] },
  play: async ({ canvasElement }) => {
    const lines = within(canvasElement).getAllByRole('listitem');
    await expect(lines.map((line) => line.textContent)).toEqual([
      'Factory configuration not found for archived-lib: /home/dev/archived-lib/docs/agents/factory.yml. Its data is kept, but new sessions are no longer read.Delete project',
      'Factory configuration not found for old-app: /home/dev/old-app/docs/agents/factory.yml. Its data is kept, but new sessions are no longer read.Delete project',
    ]);
  },
};

export const Deleting: Story = {
  args: { deleteProject: pendingDeleter() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Delete project' }),
    );
    const dialog = within(canvas.getByRole('dialog'));
    await userEvent.click(
      dialog.getByRole('button', { name: 'Delete project' }),
    );
    await expect(
      dialog.getByRole('button', { name: 'Deleting…' }),
    ).toBeDisabled();
  },
};

export const DeleteFailed: Story = {
  args: { deleteProject: deleterOf('failed'), onDeleted: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Delete project' }),
    );
    const dialog = within(canvas.getByRole('dialog'));
    await userEvent.click(
      dialog.getByRole('button', { name: 'Delete project' }),
    );
    await expect(await dialog.findByRole('alert')).toHaveTextContent(
      'Could not delete old-app. Try again.',
    );
    await expect(args.onDeleted).not.toHaveBeenCalled();
  },
};

export const DeleteRefused: Story = {
  args: { deleteProject: deleterOf('has-factory') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Delete project' }),
    );
    const dialog = within(canvas.getByRole('dialog'));
    await userEvent.click(
      dialog.getByRole('button', { name: 'Delete project' }),
    );
    await expect(await dialog.findByRole('alert')).toHaveTextContent(
      'old-app has its factory configuration again, so it was not deleted.',
    );
  },
};
