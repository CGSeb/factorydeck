import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type {
  LoadProjects,
  ListedProject,
  RemoveProject,
} from './projects-api.ts';
import {
  pendingRemover,
  projectsResponse,
  removerOf,
  someProjects,
} from './projects-list-fixtures.ts';
import { ProjectsPage } from './ProjectsPage.tsx';

function withSessions(sessions: number[]): ListedProject[] {
  return someProjects.map((project, index) => ({
    ...project,
    sessions: sessions[index] ?? 0,
  }));
}

function countingLoader(): LoadProjects {
  let reads = 0;
  return () => {
    reads += 1;
    return Promise.resolve(
      projectsResponse(withSessions(reads === 1 ? [3, 12, 0] : [3, 14, 0])),
    );
  };
}

function removingStore(): {
  loadProjects: LoadProjects;
  removeProject: RemoveProject;
} {
  let removed = false;
  return {
    loadProjects: () =>
      Promise.resolve(
        projectsResponse(
          withSessions([3, 12, 0]).filter(
            (project) => !removed || project.slug !== 'billing-service',
          ),
        ),
      ),
    removeProject: () => {
      removed = true;
      return Promise.resolve('removed');
    },
  };
}

const removing = removingStore();

const meta = {
  component: ProjectsPage,
  args: {
    loadProjects: countingLoader(),
    removeProject: fn(removerOf('removed')),
    onRemoved: fn(),
  },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/projects']}>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof ProjectsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

function names(canvasElement: HTMLElement): (string | null)[] {
  return [...canvasElement.querySelectorAll('tbody th')].map(
    (cell) => cell.textContent,
  );
}

async function openRemove(
  canvasElement: HTMLElement,
  name: string,
): Promise<HTMLElement> {
  const canvas = within(canvasElement);
  await userEvent.click(
    await canvas.findByRole('button', { name: `Remove ${name}` }),
  );
  return canvas.getByRole('dialog', { name: `Remove ${name}?` });
}

export const RemoveButtons: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const table = await canvas.findByRole('table', { name: 'Projects' });
    await expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Name', 'Remote', 'Slug', 'Added', 'Actions']);
    await expect(
      within(table)
        .getAllByRole('button')
        .map((button) => [
          button.textContent,
          button.getAttribute('aria-label'),
        ]),
    ).toEqual([
      ['Remove', 'Remove atlas'],
      ['Remove', 'Remove Billing'],
      ['Remove', 'Remove Website'],
    ]);
  },
};

export const DialogCountsWhenItOpens: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dialog = await openRemove(canvasElement, 'Billing');
    await waitFor(() =>
      expect(dialog).toHaveAccessibleDescription(
        'Its 14 sessions and every figure from them are deleted. A developer who works in this repository again makes it reappear under Remotes not added yet.',
      ),
    );
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await expect(canvas.queryByRole('dialog')).toBeNull();
    await expect(names(canvasElement)).toEqual(['atlas', 'Billing', 'Website']);
  },
};

export const DialogWithNoSession: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await openRemove(canvasElement, 'Website');
    await expect(dialog).toHaveAccessibleDescription(
      'It has no sessions. A developer who works in this repository again makes it reappear under Remotes not added yet.',
    );
  },
};

export const Removed: Story = {
  args: {
    loadProjects: removing.loadProjects,
    removeProject: fn(removing.removeProject),
    onRemoved: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const dialog = await openRemove(canvasElement, 'Billing');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Remove' }),
    );
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull());
    await expect(names(canvasElement)).toEqual(['atlas', 'Website']);
    await expect(canvas.getByText('2 projects')).toBeVisible();
    await expect(args.onRemoved).toHaveBeenCalledWith('billing-service');
    await expect(args.removeProject).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, slug: 'billing-service' }),
    );
  },
};

export const Removing: Story = {
  args: { removeProject: fn(pendingRemover()) },
  play: async ({ canvasElement }) => {
    const dialog = await openRemove(canvasElement, 'Billing');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Remove' }),
    );
    await expect(
      within(dialog).getByRole('button', { name: 'Removing…' }),
    ).toBeDisabled();
  },
};

export const RemoveFailed: Story = {
  args: { removeProject: fn(removerOf('failed')), onRemoved: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const dialog = await openRemove(canvasElement, 'Billing');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Remove' }),
    );
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Could not remove Billing. Try again.',
    );
    await expect(
      within(dialog).getByRole('button', { name: 'Remove' }),
    ).toBeEnabled();
    await expect(args.onRemoved).not.toHaveBeenCalled();
    await expect(names(canvasElement)).toEqual(['atlas', 'Billing', 'Website']);
    await expect(canvas.getByRole('dialog')).toBeVisible();
  },
};

export const RemoveNotFound: Story = {
  args: { removeProject: fn(removerOf('not-found')), onRemoved: fn() },
  play: async ({ canvasElement, args }) => {
    const dialog = await openRemove(canvasElement, 'Billing');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Remove' }),
    );
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Billing is no longer in FactoryDeck.',
    );
    await expect(args.onRemoved).not.toHaveBeenCalled();
  },
};
