import type { Meta, StoryObj } from '@storybook/react-vite';
import { Link } from 'react-router';
import { expect, userEvent, within } from 'storybook/test';
import { SettingsLeavePrompt } from './SettingsLeavePrompt.tsx';
import { memoryDataRouter } from './story-router.ts';

const meta = {
  component: SettingsLeavePrompt,
  args: { unsaved: {} },
  decorators: [
    (Story) =>
      memoryDataRouter('/projects/atlas', [
        {
          path: '/projects/atlas',
          element: (
            <>
              <Link to="/projects">Projects</Link>
              <Story />
            </>
          ),
        },
        { path: '/projects', element: <p>Project list</p> },
      ]),
  ],
} satisfies Meta<typeof SettingsLeavePrompt>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoChange: Story = {
  name: 'No unsaved change: leaving asks nothing',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('link', { name: 'Projects' }));
    await expect(await canvas.findByText('Project list')).toBeVisible();
  },
};

export const UnsavedToken: Story = {
  name: 'Unsaved token: Leave without saving the token?',
  args: { unsaved: { gitHost: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('link', { name: 'Projects' }));
    const dialog = within(
      await canvas.findByRole('dialog', {
        name: 'Leave without saving the token?',
      }),
    );
    await expect(dialog.getByRole('button', { name: 'Stay' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Leave' })).toBeVisible();
  },
};

export const UnsavedRules: Story = {
  name: 'Unsaved rules, with or without a token: Leave without saving the rules?',
  args: { unsaved: { rules: true, gitHost: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('link', { name: 'Projects' }));
    await expect(
      await canvas.findByRole('dialog', {
        name: 'Leave without saving the rules?',
      }),
    ).toBeVisible();
  },
};
