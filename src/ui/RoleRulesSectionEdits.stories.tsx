import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { LoadRoleRules } from './role-rules-api.ts';
import {
  customRules,
  defaultRules,
  pendingRulesSave,
  rulesLoaderOf,
  rulesView,
} from './role-rules-fixtures.ts';
import { LEAVE_QUESTION, SAVE_RULES } from './role-rules-rows.ts';
import {
  loadedRules,
  recordingPendingSave,
  rowAt,
  ruleNames,
  rulesFrame,
  renameFirst,
  storyProject,
} from './role-rules-story.ts';
import { RoleRulesSection } from './RoleRulesSection.tsx';

const meta = {
  component: RoleRulesSection,
  args: {
    project: storyProject,
    loadRoleRules: rulesLoaderOf(rulesView(defaultRules)),
    saveRoleRules: pendingRulesSave(),
  },
  decorators: [rulesFrame],
} satisfies Meta<typeof RoleRulesSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AddRule: Story = {
  play: async ({ canvasElement }) => {
    await loadedRules(canvasElement);
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Add rule' }));
    const added = within(rowAt(canvasElement, defaultRules.length));
    await expect(added.getByLabelText('Name')).toHaveValue('');
    await waitFor(() => expect(added.getByLabelText('Name')).toHaveFocus());
    await expect(
      canvas.getByRole('button', { name: SAVE_RULES }),
    ).toBeEnabled();
  },
};

export const MoveAndDelete: Story = {
  args: { loadRoleRules: rulesLoaderOf(rulesView(customRules)) },
  play: async ({ canvasElement }) => {
    await loadedRules(canvasElement);
    const canvas = within(canvasElement);
    await userEvent.click(
      within(rowAt(canvasElement, 0)).getByRole('button', {
        name: 'Move down',
      }),
    );
    await expect(ruleNames(canvasElement)).toEqual([
      'auditor',
      'implementer',
      'explorer',
    ]);
    const moved = within(rowAt(canvasElement, 1));
    await waitFor(() =>
      expect(moved.getByRole('button', { name: 'Move down' })).toHaveFocus(),
    );
    await userEvent.click(moved.getByRole('button', { name: 'Move down' }));
    await expect(ruleNames(canvasElement)).toEqual([
      'auditor',
      'explorer',
      'implementer',
    ]);
    await waitFor(() =>
      expect(
        within(rowAt(canvasElement, 2)).getByRole('button', {
          name: 'Move up',
        }),
      ).toHaveFocus(),
    );
    await userEvent.click(
      within(rowAt(canvasElement, 1)).getByRole('button', { name: 'Delete' }),
    );
    await expect(ruleNames(canvasElement)).toEqual(['auditor', 'implementer']);
    await expect(
      canvas.getByRole('button', { name: SAVE_RULES }),
    ).toBeEnabled();
  },
};

const resetting = recordingPendingSave();

export const ResetToDefaults: Story = {
  args: {
    loadRoleRules: rulesLoaderOf(rulesView(customRules)),
    saveRoleRules: resetting.save,
  },
  play: async ({ canvasElement }) => {
    await loadedRules(canvasElement);
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Reset to defaults' }),
    );
    await expect(canvas.queryByRole('dialog')).toBeNull();
    await expect(ruleNames(canvasElement)).toEqual(
      defaultRules.map((rule) => rule.name),
    );
    await expect(resetting.sent).toEqual([]);
    await expect(
      canvas.getByRole('button', { name: SAVE_RULES }),
    ).toBeEnabled();
  },
};

export const UndoneEditKeepsSaveDisabled: Story = {
  play: async ({ canvasElement }) => {
    await renameFirst(canvasElement, 'maker');
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', { name: SAVE_RULES }),
    ).toBeEnabled();
    const field = within(rowAt(canvasElement, 0)).getByLabelText('Name');
    await userEvent.clear(field);
    await userEvent.type(field, 'builder');
    await expect(
      canvas.getByRole('button', { name: SAVE_RULES }),
    ).toBeDisabled();
  },
};

export const UnsavedChanges: Story = {
  play: async ({ canvasElement }) => {
    await renameFirst(canvasElement, 'maker');
    const canvas = within(canvasElement);
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    await expect(unload.defaultPrevented).toBe(true);
    await userEvent.click(canvas.getByRole('link', { name: 'Roles' }));
    const dialog = await canvas.findByRole('dialog', { name: LEAVE_QUESTION });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Stay' }));
    await expect(canvas.queryByRole('dialog')).toBeNull();
    await expect(
      within(rowAt(canvasElement, 0)).getByLabelText('Name'),
    ).toHaveValue('maker');
    await userEvent.click(canvas.getByRole('link', { name: 'Roles' }));
    await userEvent.click(
      within(
        await canvas.findByRole('dialog', { name: LEAVE_QUESTION }),
      ).getByRole('button', { name: 'Leave' }),
    );
    await expect(await canvas.findByText('Roles page')).toBeVisible();
  },
};

export const NoChangesLeaveFreely: Story = {
  play: async ({ canvasElement }) => {
    await loadedRules(canvasElement);
    const canvas = within(canvasElement);
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    await expect(unload.defaultPrevented).toBe(false);
    await userEvent.click(canvas.getByRole('link', { name: 'Roles' }));
    await expect(await canvas.findByText('Roles page')).toBeVisible();
  },
};

function changingRules(): LoadRoleRules {
  let calls = 0;
  return () => {
    calls += 1;
    const rules =
      calls === 1
        ? customRules
        : [{ name: 'refreshed', description: 'x', agentType: null }];
    return Promise.resolve(rulesView(rules, 0.05));
  };
}

export const RefreshKeepsUnsavedChanges: Story = {
  args: { loadRoleRules: changingRules() },
  play: async ({ canvasElement }) => {
    await renameFirst(canvasElement, 'maker');
    await new Promise((done) => setTimeout(done, 200));
    await expect(ruleNames(canvasElement)).toEqual([
      'maker',
      'auditor',
      'explorer',
    ]);
  },
};

export const RefreshFollowsWithoutChanges: Story = {
  args: { loadRoleRules: changingRules() },
  play: async ({ canvasElement }) => {
    await loadedRules(canvasElement);
    await waitFor(() =>
      expect(ruleNames(canvasElement)).toEqual(['refreshed']),
    );
  },
};
