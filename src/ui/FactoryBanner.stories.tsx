import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { apiFailure, appFailure } from './git-host-fixtures.ts';
import { archivedLib, oldApp } from './factory-fixtures.ts';
import { FactoryBanner } from './FactoryBanner.tsx';

const meta = {
  component: FactoryBanner,
  args: { missing: [oldApp] },
} satisfies Meta<typeof FactoryBanner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OneProject: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('listitem')).toHaveTextContent(
      'Factory configuration not found for Old App: /home/dev/old-app/docs/agents/factory.yml. Its data is kept, but new sessions are no longer read.',
    );
    await expect(
      canvas.getByText(/Factory configuration not found for Old App/),
    ).toHaveAttribute('title', '/home/dev/old-app');
    await expect(canvas.queryByRole('button')).toBeNull();
  },
};

export const TwoProjects: Story = {
  args: { missing: [archivedLib, oldApp] },
  play: async ({ canvasElement }) => {
    const lines = within(canvasElement).getAllByRole('listitem');
    await expect(lines.map((line) => line.textContent)).toEqual([
      'Factory configuration not found for archived-lib: /home/dev/archived-lib/docs/agents/factory.yml. Its data is kept, but new sessions are no longer read.',
      'Factory configuration not found for Old App: /home/dev/old-app/docs/agents/factory.yml. Its data is kept, but new sessions are no longer read.',
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
      within(canvasElement).getByText(/Could not read GitHub for example-app/),
    ).toHaveAttribute('title', '/home/dev/example-app');
    await expect(within(canvasElement).queryByRole('button')).toBeNull();
  },
};
