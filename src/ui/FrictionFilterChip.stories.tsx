import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { FrictionFilterChip } from './FrictionFilterChip.tsx';

const meta = {
  component: FrictionFilterChip,
  args: { text: 'Session: Build the frictions page', onRemove: fn() },
} satisfies Meta<typeof FrictionFilterChip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Session: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText('Session: Build the frictions page'),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole('button', { name: 'Remove filter' }),
    );
    await expect(args.onRemove).toHaveBeenCalledOnce();
  },
};

export const LongIssue: Story = {
  name: 'A long issue title',
  args: {
    text: 'Issue: #40 Read Codex sessions next to Claude Code sessions, with their own sub-agents and models',
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 320 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const chip = canvasElement.querySelector('.fd-friction-chip');
    await expect(chip?.getBoundingClientRect().width ?? 0).toBeLessThanOrEqual(
      320,
    );
  },
};
