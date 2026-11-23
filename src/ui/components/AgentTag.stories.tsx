import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { AgentTag } from './AgentTag.tsx';
import { surfaceFrame } from './story-frame.ts';

const meta = {
  title: 'Components/AgentTag',
  component: AgentTag,
  decorators: [surfaceFrame],
  args: { agent: 'claude-code' },
} satisfies Meta<typeof AgentTag>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ClaudeCode: Story = {
  play: async ({ canvasElement }) => {
    const tag = within(canvasElement).getByText('Claude Code');
    await expect(tag).toHaveAttribute('data-tone', 'neutral');
    await expect(tag.style.background).toBe('var(--fd-neutral-bg)');
  },
};

export const Codex: Story = {
  args: { agent: 'codex' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Codex')).toHaveAttribute(
      'data-tone',
      'neutral',
    );
  },
};
