import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { SerenityBadge } from './SerenityBadge.tsx';
import { surfaceFrame } from './story-frame.ts';

const meta = {
  title: 'Components/SerenityBadge',
  component: SerenityBadge,
  decorators: [surfaceFrame],
  args: { report: { score: 92, threshold: 80 } },
} satisfies Meta<typeof SerenityBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AboveThreshold: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('serenity 92'),
    ).toHaveAttribute('data-tone', 'success');
  },
};

export const BelowThreshold: Story = {
  args: { report: { score: 64, threshold: 80 } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('serenity 64 · below threshold'),
    ).toHaveAttribute('data-tone', 'warning');
  },
};

export const PathAboveThreshold: Story = {
  name: 'Path above threshold',
  args: { report: { score: 88, threshold: 80, firstScore: 64 } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('serenity 64 → 88'),
    ).toHaveAttribute('data-tone', 'success');
  },
};

export const PathBelowThreshold: Story = {
  name: 'Path below threshold',
  args: { report: { score: 72, threshold: 80, firstScore: 85 } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('serenity 85 → 72 · below threshold'),
    ).toHaveAttribute('data-tone', 'warning');
  },
};
