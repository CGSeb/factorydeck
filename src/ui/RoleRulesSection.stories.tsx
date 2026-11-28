import { createElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { DATABASE_UNREACHABLE } from './auth-api.ts';
import { UNREACHABLE_MESSAGE } from './overview-api.ts';
import { SAVED, SAVING } from './project-settings-form.ts';
import {
  customRules,
  defaultRules,
  pendingRules,
  pendingRulesSave,
  rulesLoaderOf,
  rulesSaverOf,
  rulesServer,
  rulesView,
} from './role-rules-fixtures.ts';
import { NO_RULE, SAVE_RULES } from './role-rules-rows.ts';
import {
  loadedRules,
  recordingPendingSave,
  rowAt,
  ruleNames,
  RulesWithPrompt,
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
  render: (args) => createElement(RulesWithPrompt, args),
} satisfies Meta<typeof RoleRulesSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  args: { loadRoleRules: pendingRules() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { name: 'Role rules' }),
    ).toBeVisible();
    await expect(canvas.getByText('Loading…')).toBeVisible();
  },
};

export const Defaults: Story = {
  play: async ({ canvasElement }) => {
    await loadedRules(canvasElement);
    const canvas = within(canvasElement);
    await expect(ruleNames(canvasElement)).toEqual(
      defaultRules.map((rule) => rule.name),
    );
    await expect(
      canvas.getAllByRole('columnheader').map((cell) => cell.textContent),
    ).toEqual(['Name', 'Description pattern', 'Agent type pattern', 'Actions']);
    const first = within(rowAt(canvasElement, 0));
    const second = within(rowAt(canvasElement, 1));
    for (const label of [
      'Name of rule 2',
      'Description pattern of rule 2',
      'Agent type pattern of rule 2',
    ]) {
      await expect(second.getByLabelText(label)).toBeVisible();
    }
    for (const name of [
      'Move rule 2 up',
      'Move rule 2 down',
      'Delete rule 2',
    ]) {
      await expect(second.getByRole('button', { name })).toBeVisible();
    }
    await expect(
      first.getByLabelText(/^Description pattern of rule \d+$/),
    ).toHaveValue('^(Build|Worker for) ');
    await expect(
      first.getByLabelText(/^Agent type pattern of rule \d+$/),
    ).toHaveValue('');
    await expect(
      first.getByRole('button', { name: /^Move rule \d+ up$/ }),
    ).toBeDisabled();
    await expect(
      first.getByRole('button', { name: /^Move rule \d+ down$/ }),
    ).toBeEnabled();
    const last = within(rowAt(canvasElement, defaultRules.length - 1));
    await expect(
      last.getByRole('button', { name: /^Move rule \d+ down$/ }),
    ).toBeDisabled();
    await expect(
      canvas.getByRole('button', { name: SAVE_RULES }),
    ).toBeDisabled();
    await expect(
      canvas.getByRole('button', { name: 'Add rule' }),
    ).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Reset to defaults' }),
    ).toBeVisible();
  },
};

export const CustomList: Story = {
  args: { loadRoleRules: rulesLoaderOf(rulesView(customRules)) },
  play: async ({ canvasElement }) => {
    await loadedRules(canvasElement);
    await expect(ruleNames(canvasElement)).toEqual([
      'implementer',
      'auditor',
      'explorer',
    ]);
    const explorer = within(rowAt(canvasElement, 2));
    await expect(
      explorer.getByLabelText(/^Description pattern of rule \d+$/),
    ).toHaveValue('');
    await expect(
      explorer.getByLabelText(/^Agent type pattern of rule \d+$/),
    ).toHaveValue('^Explore$');
  },
};

export const EmptyList: Story = {
  args: { loadRoleRules: rulesLoaderOf(rulesView([])) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(NO_RULE)).toBeVisible();
    await expect(canvas.queryByRole('table')).toBeNull();
    await expect(
      canvas.getByRole('button', { name: SAVE_RULES }),
    ).toBeDisabled();
  },
};

export const Unreachable: Story = {
  args: {
    loadRoleRules: rulesLoaderOf({ status: 'unreachable', refreshSeconds: 60 }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(UNREACHABLE_MESSAGE)).toBeVisible();
  },
};

const saving = recordingPendingSave();

export const Saving: Story = {
  args: { saveRoleRules: saving.save },
  play: async ({ canvasElement }) => {
    await renameFirst(canvasElement, 'maker');
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: SAVE_RULES }));
    await expect(canvas.getByRole('button', { name: SAVING })).toBeDisabled();
    const sent = saving.sent[0];
    await expect(sent?.[0]).toEqual({
      name: 'maker',
      description: '^(Build|Worker for) ',
      agentType: null,
    });
    await expect(sent).toHaveLength(defaultRules.length);
  },
};

export const Saved: Story = {
  args: rulesServer(defaultRules),
  play: async ({ canvasElement }) => {
    await renameFirst(canvasElement, ' maker ');
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: SAVE_RULES }));
    await expect(await canvas.findByText(SAVED)).toBeVisible();
    await waitFor(() =>
      expect(
        within(rowAt(canvasElement, 0)).getByLabelText(/^Name of rule \d+$/),
      ).toHaveValue('maker'),
    );
    await expect(
      canvas.getByRole('button', { name: SAVE_RULES }),
    ).toBeDisabled();
  },
};

async function refused(
  canvasElement: HTMLElement,
  label: string,
  message: string,
) {
  await renameFirst(canvasElement, 'maker');
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: SAVE_RULES }));
  await expect(await canvas.findByText(message)).toBeVisible();
  const field = within(rowAt(canvasElement, 1)).getByLabelText(
    `${label} of rule 2`,
  );
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(field).toHaveAccessibleDescription(message);
  await waitFor(() => expect(field).toHaveFocus());
  await expect(
    within(rowAt(canvasElement, 0)).getByLabelText(/^Name of rule \d+$/),
  ).toHaveValue('maker');
}

export const RefusedName: Story = {
  args: {
    saveRoleRules: rulesSaverOf({
      status: 'invalid',
      field: 'name',
      rule: 1,
      message: 'main and unassigned are reserved',
    }),
  },
  play: async ({ canvasElement }) => {
    await refused(canvasElement, 'Name', 'main and unassigned are reserved');
  },
};

export const RefusedDescription: Story = {
  args: {
    saveRoleRules: rulesSaverOf({
      status: 'invalid',
      field: 'description',
      rule: 1,
      message: 'Give a description or an agent type pattern',
    }),
  },
  play: async ({ canvasElement }) => {
    await refused(
      canvasElement,
      'Description pattern',
      'Give a description or an agent type pattern',
    );
  },
};

export const RefusedAgentType: Story = {
  args: {
    saveRoleRules: rulesSaverOf({
      status: 'invalid',
      field: 'agentType',
      rule: 1,
      message: 'Not a valid regular expression: Unterminated group',
    }),
  },
  play: async ({ canvasElement }) => {
    await refused(
      canvasElement,
      'Agent type pattern',
      'Not a valid regular expression: Unterminated group',
    );
  },
};

export const RefusedList: Story = {
  args: {
    saveRoleRules: rulesSaverOf({
      status: 'invalid',
      field: 'rules',
      rule: undefined,
      message: 'At most 50 rules',
    }),
  },
  play: async ({ canvasElement }) => {
    await renameFirst(canvasElement, 'maker');
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: SAVE_RULES }));
    await expect(await canvas.findByText('At most 50 rules')).toBeVisible();
    for (const input of canvas.getAllByRole('textbox')) {
      await expect(input).toHaveAttribute('aria-invalid', 'false');
    }
  },
};

export const RefusedProjectGone: Story = {
  args: { saveRoleRules: rulesSaverOf({ status: 'missing' }) },
  play: async ({ canvasElement }) => {
    await renameFirst(canvasElement, 'maker');
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: SAVE_RULES }));
    await expect(
      await canvas.findByText('atlas is no longer in FactoryDeck.'),
    ).toBeVisible();
  },
};

export const RefusedDatabaseDown: Story = {
  args: {
    saveRoleRules: rulesSaverOf({
      status: 'failed',
      message: DATABASE_UNREACHABLE,
    }),
  },
  play: async ({ canvasElement }) => {
    await renameFirst(canvasElement, 'maker');
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: SAVE_RULES }));
    await expect(await canvas.findByText(DATABASE_UNREACHABLE)).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: SAVE_RULES }),
    ).toBeEnabled();
  },
};
