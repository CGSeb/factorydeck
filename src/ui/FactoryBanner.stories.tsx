import type { Meta, StoryObj } from '@storybook/react-vite';
import { type ReactElement, useState } from 'react';
import type { DeleteOutcome } from './factory-api.ts';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { apiFailure, appFailure } from './git-host-fixtures.ts';
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

export const CollectionErrors: Story = {
  args: { missing: [oldApp], failures: [apiFailure, appFailure] },
  play: async ({ canvasElement }) => {
    const lines = within(canvasElement).getAllByRole('listitem');
    await expect(lines.map((line) => line.textContent).slice(1)).toEqual([
      'Could not read GitLab for example-api: glab: 401 Unauthorized.',
      'Could not read GitHub for example-app: gh not found.',
    ]);
    await expect(
      within(canvasElement).getAllByRole('button', { name: 'Delete project' }),
    ).toHaveLength(1);
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

function ProjectLeavesAndComesBack(): ReactElement {
  const [listed, setListed] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setListed(!listed)}>
        Toggle project
      </button>
      <FactoryBanner
        missing={listed ? [oldApp] : []}
        deleteProject={deleterOf('has-factory')}
        onDeleted={() => undefined}
      />
    </>
  );
}

export const DialogClearedWhenProjectLeaves: Story = {
  render: () => <ProjectLeavesAndComesBack />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Delete project' }),
    );
    const dialog = within(canvas.getByRole('dialog'));
    await userEvent.click(
      dialog.getByRole('button', { name: 'Delete project' }),
    );
    await dialog.findByRole('alert');
    await userEvent.click(
      canvas.getByRole('button', { name: 'Toggle project' }),
    );
    await expect(canvas.queryByRole('dialog')).toBeNull();
    await userEvent.click(
      canvas.getByRole('button', { name: 'Toggle project' }),
    );
    await expect(
      canvas.getByRole('button', { name: 'Delete project' }),
    ).toBeVisible();
    await expect(canvas.queryByRole('dialog')).toBeNull();
  },
};

function DeletionFinishesLater(): ReactElement {
  const [finish, setFinish] = useState<() => void>();
  const deleteProject = (): Promise<DeleteOutcome> =>
    new Promise((resolve) => {
      setFinish(() => () => resolve('deleted'));
    });
  return (
    <>
      <button type="button" onClick={() => finish?.()}>
        Finish deletion
      </button>
      <FactoryBanner
        missing={[archivedLib, oldApp]}
        deleteProject={deleteProject}
        onDeleted={() => undefined}
      />
    </>
  );
}

export const DeletionKeepsAnotherDialogOpen: Story = {
  render: () => <DeletionFinishesLater />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [first, second] = canvas.getAllByRole('button', {
      name: 'Delete project',
    });
    if (first === undefined || second === undefined) throw new Error('lines');
    await userEvent.click(first);
    const dialog = within(canvas.getByRole('dialog'));
    await userEvent.click(
      dialog.getByRole('button', { name: 'Delete project' }),
    );
    await userEvent.keyboard('{Escape}');
    await userEvent.click(second);
    await expect(
      canvas.getByRole('dialog', { name: 'Delete old-app?' }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole('button', { name: 'Finish deletion' }),
    );
    await expect(
      canvas.getByRole('dialog', { name: 'Delete old-app?' }),
    ).toBeVisible();
  },
};
