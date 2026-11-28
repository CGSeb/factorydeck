import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { SAVE, SAVED } from './project-settings-form.ts';
import type {
  ListedProject,
  LoadProjects,
  SaveProject,
} from './projects-api.ts';
import {
  pendingProjects,
  pendingSave,
  someProjects,
} from './projects-list-fixtures.ts';
import { ProjectSettingsPage } from './ProjectSettingsPage.tsx';
import {
  customRules,
  pendingRulesSave,
  rulesView,
} from './role-rules-fixtures.ts';
import { memoryDataRouter } from './story-router.ts';

function projectAt(index: number): ListedProject {
  const project = someProjects[index];
  if (project === undefined) throw new Error('No project fixture');
  return project;
}

const atlas = projectAt(0);

const meta = {
  component: ProjectSettingsPage,
  args: {
    loadProjects: pendingProjects(),
    saveProject: pendingSave(),
  },
  decorators: [
    (Story) =>
      memoryDataRouter('/projects/atlas', [
        { path: '/projects/:slug', element: <Story /> },
      ]),
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

function slowServer(): {
  loadProjects: LoadProjects;
  saveProject: SaveProject;
} {
  let stored = atlas;
  const later = <T,>(value: T, ms: number): Promise<T> =>
    new Promise((resolve) => setTimeout(() => resolve(value), ms));
  return {
    loadProjects: () =>
      later(
        {
          status: 'ok',
          refreshSeconds: 0.02,
          secretKey: true,
          projects: [stored],
          pendingRemotes: [],
          noRemote: null,
        } as const,
        150,
      ),
    saveProject: (_id, changes) => {
      stored = { ...stored, ...changes };
      return later({ status: 'saved', project: stored } as const, 20);
    },
  };
}

export const SavedOverStaleRefresh: Story = {
  name: 'Saved: a refresh sent before the save does not bring the old name back',
  args: slowServer(),
  play: async ({ canvasElement }) => {
    const canvas = await rename(canvasElement, 'Atlas tools');
    await userEvent.click(canvas.getByRole('button', { name: SAVE }));
    await expect(await canvas.findByText(SAVED)).toBeVisible();
    const titles = new Set<string>();
    const names = new Set<string>();
    for (let frame = 0; frame < 40; frame += 1) {
      titles.add(canvas.getByRole('heading', { level: 1 }).textContent);
      names.add(canvas.getByLabelText<HTMLInputElement>('Name').value);
      await new Promise((done) => setTimeout(done, 10));
    }
    await expect([...titles]).toEqual(['Atlas tools']);
    await expect([...names]).toEqual(['Atlas tools']);
  },
};

function changingLoader(): LoadProjects {
  let calls = 0;
  return () => {
    calls += 1;
    const project =
      calls === 1
        ? atlas
        : { ...atlas, name: 'Atlas core', remote: 'github.com/example/atlas' };
    return Promise.resolve({
      status: 'ok',
      refreshSeconds: 0.05,
      secretKey: true,
      projects: [project],
      pendingRemotes: [],
      noRemote: null,
    });
  };
}

export const RefreshKeepsEdits: Story = {
  args: { loadProjects: changingLoader() },
  play: async ({ canvasElement }) => {
    const canvas = await rename(canvasElement, 'Atlas tools');
    await expect(
      await canvas.findByRole('heading', { level: 1, name: 'Atlas core' }),
    ).toBeVisible();
    await expect(canvas.getByLabelText('Name')).toHaveValue('Atlas tools');
    await expect(canvas.getByLabelText('Git remote')).toHaveValue(
      'github.com/example/atlas',
    );
  },
};

function refreshingProjects(): LoadProjects {
  return () =>
    Promise.resolve({
      status: 'ok',
      refreshSeconds: 0.05,
      secretKey: true,
      projects: [atlas],
      pendingRemotes: [],
      noRemote: null,
    });
}

export const RoleRulesAfterGeneral: Story = {
  name: 'Role rules: after General, kept with unsaved changes while the page refreshes',
  args: {
    loadProjects: refreshingProjects(),
    loadRoleRules: () => Promise.resolve(rulesView(customRules, 0.05)),
    saveRoleRules: pendingRulesSave(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rules = await canvas.findByRole('table');
    await expect(
      canvas.getAllByRole('heading', { level: 2 }).map((h) => h.textContent),
    ).toEqual(['General', 'Role rules']);
    const field = within(rules).getAllByLabelText(/^Name of rule \d+$/)[0];
    if (field === undefined) throw new Error('No rule');
    await userEvent.clear(field);
    await userEvent.type(field, 'maker');
    await new Promise((done) => setTimeout(done, 200));
    await expect(
      within(rules).getAllByLabelText(/^Name of rule \d+$/)[0],
    ).toHaveValue('maker');
    await expect(
      canvas.getByRole('button', { name: 'Save rules' }),
    ).toBeEnabled();
  },
};
