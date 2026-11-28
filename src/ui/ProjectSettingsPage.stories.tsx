import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { SAVE, SAVED, SAVING } from './project-settings-form.ts';
import type { ListedProject } from './projects-api.ts';
import {
  pendingProjects,
  pendingSave,
  projectsLoaderOf,
  projectsResponse,
  savingAnswer,
  someProjects,
} from './projects-list-fixtures.ts';
import { PROJECTS_REFUSED } from './projects-view.ts';
import { ProjectSettingsPage } from './ProjectSettingsPage.tsx';
import { memoryDataRouter } from './story-router.ts';

function projectAt(index: number): ListedProject {
  const project = someProjects[index];
  if (project === undefined) throw new Error('No project fixture');
  return project;
}

const atlas = projectAt(0);
const renamed: ListedProject = { ...atlas, name: 'Atlas tools' };

const meta = {
  component: ProjectSettingsPage,
  args: {
    loadProjects: projectsLoaderOf(projectsResponse(someProjects)),
    saveProject: fn(savingAnswer({ status: 'saved', project: renamed })),
  },
  decorators: [
    (Story, { parameters }) =>
      memoryDataRouter(
        typeof parameters['entry'] === 'string'
          ? parameters['entry']
          : '/projects/atlas',
        [
          { path: '/projects/:slug', element: <Story /> },
          { path: '/projects', element: <p>Project list</p> },
        ],
      ),
  ],
} satisfies Meta<typeof ProjectSettingsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

async function rename(canvasElement: HTMLElement, name: string) {
  const canvas = within(canvasElement);
  const field = await canvas.findByLabelText('Name');
  await userEvent.clear(field);
  await userEvent.type(field, name);
  return canvas;
}

async function refusedOn(
  canvasElement: HTMLElement,
  label: string,
  message: string,
) {
  const canvas = await rename(canvasElement, 'Atlas tools');
  await userEvent.click(canvas.getByRole('button', { name: SAVE }));
  await expect(await canvas.findByText(message)).toBeVisible();
  const field = canvas.getByLabelText(label);
  await waitFor(() => expect(field).toHaveFocus());
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(canvas.getByLabelText('Name')).toHaveValue('Atlas tools');
}

export const Loading: Story = {
  args: { loadProjects: pendingProjects() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('link', { name: '← Projects' }),
    ).toBeVisible();
    await expect(canvas.getByText('Loading…')).toBeVisible();
    await expect(
      canvasElement.querySelector('.fd-page-summary[aria-hidden="true"]'),
    ).not.toBeNull();
  },
};

export const Form: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole('heading', { level: 1, name: 'atlas' }),
    ).toBeVisible();
    await expect(
      canvas.getByText('gitlab.example.test/platform/tools/atlas · 1 session'),
    ).toBeVisible();
    await expect(
      canvas.getByRole('heading', { level: 2, name: 'General' }),
    ).toBeVisible();
    await expect(canvas.getByLabelText('Name')).toHaveValue('atlas');
    await expect(canvas.getByLabelText('Git remote')).toHaveValue(
      'gitlab.example.test/platform/tools/atlas',
    );
    const save = canvas.getByRole('button', { name: SAVE });
    await expect(save).toBeDisabled();
    await userEvent.type(canvas.getByLabelText('Name'), 'x');
    await expect(save).toBeEnabled();
    await userEvent.type(canvas.getByLabelText('Name'), '{backspace}');
    await expect(save).toBeDisabled();
    await expect(
      canvas.getByRole('link', { name: '← Projects' }),
    ).toHaveAttribute('href', '/projects');
  },
};

export const ManySessions: Story = {
  parameters: { entry: '/projects/billing-service' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText(
        'github.com/example-org/billing-service · 1,284 sessions',
      ),
    ).toBeVisible();
  },
};

export const Saving: Story = {
  args: { saveProject: fn(pendingSave()) },
  play: async ({ canvasElement }) => {
    const canvas = await rename(canvasElement, 'Atlas tools');
    await userEvent.click(canvas.getByRole('button', { name: SAVE }));
    const button = await canvas.findByRole('button', { name: SAVING });
    await expect(button).toBeDisabled();
    await expect(canvas.getByLabelText('Name')).toBeEnabled();
    await expect(canvas.getByLabelText('Git remote')).toBeEnabled();
  },
};

export const Saved: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = await rename(canvasElement, 'Atlas tools');
    await userEvent.click(canvas.getByRole('button', { name: SAVE }));
    await expect(await canvas.findByText(SAVED)).toBeVisible();
    await expect(args.saveProject).toHaveBeenCalledWith(atlas.id, {
      name: 'Atlas tools',
    });
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Atlas tools' }),
    ).toBeVisible();
    await expect(canvas.getByRole('button', { name: SAVE })).toBeDisabled();
    await userEvent.type(canvas.getByLabelText('Name'), '!');
    await expect(canvas.queryByText(SAVED)).toBeNull();
  },
};

export const RemoteRefused: Story = {
  args: {
    saveProject: fn(
      savingAnswer({
        status: 'invalid',
        field: 'remote',
        message: 'Not a git remote',
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    await refusedOn(canvasElement, 'Git remote', 'Not a git remote');
  },
};

export const RemoteTaken: Story = {
  args: {
    saveProject: fn(
      savingAnswer({
        status: 'invalid',
        field: 'remote',
        message: 'This remote is already the project Website',
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    await refusedOn(
      canvasElement,
      'Git remote',
      'This remote is already the project Website',
    );
  },
};

export const NameRefused: Story = {
  args: {
    saveProject: fn(
      savingAnswer({
        status: 'invalid',
        field: 'name',
        message: 'Name is required',
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    await refusedOn(canvasElement, 'Name', 'Name is required');
  },
};

export const NoLongerThere: Story = {
  args: { saveProject: fn(savingAnswer({ status: 'missing' })) },
  play: async ({ canvasElement }) => {
    const canvas = await rename(canvasElement, 'Atlas tools');
    await userEvent.click(canvas.getByRole('button', { name: SAVE }));
    await expect(
      await canvas.findByText('atlas is no longer in FactoryDeck.'),
    ).toBeVisible();
    await expect(canvas.getByLabelText('Name')).toHaveValue('Atlas tools');
  },
};

export const SaveUnreachable: Story = {
  args: {
    saveProject: fn(
      savingAnswer({
        status: 'failed',
        message: UNREACHABLE_MESSAGE,
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = await rename(canvasElement, 'Atlas tools');
    await userEvent.click(canvas.getByRole('button', { name: SAVE }));
    await expect(await canvas.findByText(UNREACHABLE_MESSAGE)).toBeVisible();
    await expect(canvas.getByLabelText('Name')).toHaveValue('Atlas tools');
  },
};

export const UnknownSlug: Story = {
  parameters: { entry: '/projects/nothing-here' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText('No project nothing-here.'),
    ).toBeVisible();
    await expect(canvas.queryByRole('form')).toBeNull();
    await expect(
      canvas.getByRole('link', { name: '← Projects' }),
    ).toHaveAttribute('href', '/projects');
  },
};

export const SlugIsCaseSensitive: Story = {
  parameters: { entry: '/projects/Atlas' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('No project Atlas.')).toBeVisible();
  },
};

export const DevRefused: Story = {
  args: {
    loadProjects: projectsLoaderOf({ status: 'refused', refreshSeconds: 60 }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(PROJECTS_REFUSED)).toBeVisible();
    await expect(canvas.queryByLabelText('Name')).toBeNull();
  },
};

export const Unreachable: Story = {
  args: {
    loadProjects: projectsLoaderOf({
      status: 'unreachable',
      refreshSeconds: 60,
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(UNREACHABLE_MESSAGE)).toBeVisible();
  },
};
