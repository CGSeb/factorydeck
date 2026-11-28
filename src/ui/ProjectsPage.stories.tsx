import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { ADD, ADD_PROJECT_TITLE } from './AddProjectDialog.tsx';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import {
  PROJECTS_NOW,
  addedProject,
  addingAnswer,
  pendingProjects,
  projectsLoaderOf,
  projectsResponse,
  someNoRemote,
  somePendingRemotes,
  someProjects,
} from './projects-list-fixtures.ts';
import {
  NO_PROJECT,
  NO_REMOTE,
  PROJECTS_REFUSED,
  REMOTES_NOT_ADDED,
} from './projects-view.ts';
import { ProjectsPage } from './ProjectsPage.tsx';
import { ADD_REMOTE } from './RemotesNotAdded.tsx';

const meta = {
  component: ProjectsPage,
  args: {
    loadProjects: projectsLoaderOf(projectsResponse(someProjects)),
    addProject: fn(addingAnswer({ status: 'added', project: addedProject })),
    now: PROJECTS_NOW,
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

function rowTexts(canvasElement: HTMLElement): string[][] {
  return [...canvasElement.querySelectorAll('tbody tr')].map((row) =>
    [...row.children].map((cell) => cell.textContent),
  );
}

export const Loading: Story = {
  args: { loadProjects: pendingProjects() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Projects' }),
    ).toBeVisible();
    await expect(canvas.getByText('Loading…')).toBeVisible();
    await expect(
      canvasElement.querySelector('.fd-page-summary[aria-hidden="true"]'),
    ).not.toBeNull();
    await expect(canvas.queryByRole('button', { name: ADD })).toBeNull();
    await expect(
      canvas.queryByRole('heading', { name: REMOTES_NOT_ADDED }),
    ).toBeNull();
  },
};

export const Empty: Story = {
  args: { loadProjects: projectsLoaderOf(projectsResponse([])) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(NO_PROJECT)).toBeVisible();
    await expect(canvas.getByText('0 projects')).toBeVisible();
    await expect(canvas.queryByRole('table')).toBeNull();
    await expect(canvas.getByRole('button', { name: ADD })).toBeVisible();
  },
};

export const OneProject: Story = {
  args: {
    loadProjects: projectsLoaderOf(
      projectsResponse([{ ...addedProject, sessions: 0 }]),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('table', { name: 'Projects' });
    await expect(canvas.getByText('1 project')).toBeVisible();
  },
};

export const List: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const table = await canvas.findByRole('table', { name: 'Projects' });
    await expect(canvas.getByText('3 projects')).toBeVisible();
    await expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Name', 'Remote', 'Slug', 'Added']);
    await expect(rowTexts(canvasElement)).toEqual([
      [
        'atlas',
        'gitlab.example.test/platform/tools/atlas',
        'atlas',
        '3 Feb 2026',
      ],
      [
        'Billing',
        'github.com/example-org/billing-service',
        'billing-service',
        '15 Jan 2026',
      ],
      ['Website', 'github.com/example-org/website', 'website', '10 Mar 2026'],
    ]);
    await expect(
      within(table).getByRole('link', { name: 'Billing' }),
    ).toHaveAttribute('href', '/projects/billing-service');
  },
};

export const AddForm: Story = {
  name: 'Add form: the project shows once the API answers',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: ADD }));
    const dialog = canvas.getByRole('dialog', { name: ADD_PROJECT_TITLE });
    await waitFor(() =>
      expect(within(dialog).getByLabelText('Git remote')).toHaveFocus(),
    );
    await userEvent.type(
      within(dialog).getByLabelText('Git remote'),
      'git@github.com:example-org/factorydeck.git',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: ADD }));
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull());
    await expect(args.addProject).toHaveBeenCalledWith({
      remote: 'git@github.com:example-org/factorydeck.git',
      name: '',
    });
    await expect(canvas.getByText('4 projects')).toBeVisible();
    await expect(rowTexts(canvasElement).map((row) => row[0])).toEqual([
      'atlas',
      'Billing',
      'factorydeck',
      'Website',
    ]);
  },
};

export const DevRefused: Story = {
  args: {
    loadProjects: projectsLoaderOf({ status: 'refused', refreshSeconds: 10 }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(PROJECTS_REFUSED)).toBeVisible();
    await expect(canvas.queryByRole('button', { name: ADD })).toBeNull();
    await expect(canvas.queryByRole('table')).toBeNull();
  },
};

export const Error: Story = {
  name: 'Error: the database does not answer',
  args: {
    loadProjects: projectsLoaderOf({
      status: 'unreachable',
      refreshSeconds: 10,
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(UNREACHABLE_MESSAGE)).toBeVisible();
    await expect(canvas.queryByRole('button', { name: ADD })).toBeNull();
  },
};

const withRemotes = projectsLoaderOf(
  projectsResponse(someProjects, somePendingRemotes, someNoRemote),
);

function remoteLines(
  canvasElement: HTMLElement,
): (string | null | undefined)[] {
  const table = canvasElement.querySelector(
    `table[aria-label="${REMOTES_NOT_ADDED}"]`,
  );
  return [...(table?.querySelectorAll('tbody th') ?? [])].map(
    (cell) => cell.firstChild?.textContent,
  );
}

export const RemotesNotAddedYet: Story = {
  name: 'Remotes not added yet: listed under the projects',
  args: { loadProjects: withRemotes },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('table', { name: REMOTES_NOT_ADDED });
    await expect(
      canvas.getByText('3 projects · 2 remotes not added'),
    ).toBeVisible();
    const tables = canvas.getAllByRole('table');
    await expect(
      tables.map((table) => table.getAttribute('aria-label')),
    ).toEqual(['Projects', REMOTES_NOT_ADDED]);
    await expect(remoteLines(canvasElement)).toEqual([
      'github.com/example-org/factorydeck',
      'gitlab.example.test/platform/tools/ledger',
      NO_REMOTE,
    ]);
  },
};

export const OnlyNoRemote: Story = {
  name: 'Remotes not added yet: No remote is not counted in the summary',
  args: {
    loadProjects: projectsLoaderOf(
      projectsResponse(someProjects, [], someNoRemote),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('table', { name: REMOTES_NOT_ADDED });
    await expect(canvas.getByText('3 projects')).toBeVisible();
  },
};

export const AddRemote: Story = {
  name: 'Add a remote: the form is filled, and the line goes once added',
  args: { loadProjects: withRemotes },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', {
        name: `${ADD_REMOTE} github.com/example-org/factorydeck`,
      }),
    );
    const dialog = canvas.getByRole('dialog', { name: ADD_PROJECT_TITLE });
    await expect(within(dialog).getByLabelText('Git remote')).toHaveValue(
      'https://github.com/example-org/factorydeck',
    );
    await expect(within(dialog).getByLabelText('Name')).toHaveValue('');
    await userEvent.click(within(dialog).getByRole('button', { name: ADD }));
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull());
    await expect(args.addProject).toHaveBeenCalledWith({
      remote: 'https://github.com/example-org/factorydeck',
      name: '',
    });
    await expect(
      canvas.getByText('4 projects · 1 remote not added'),
    ).toBeVisible();
    await expect(remoteLines(canvasElement)).toEqual([
      'gitlab.example.test/platform/tools/ledger',
      NO_REMOTE,
    ]);
  },
};
