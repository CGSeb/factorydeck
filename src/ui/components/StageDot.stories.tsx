import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { STAGE_GROUP_COLORS, type StageGroup, StageDot } from './StageDot.tsx';
import { surfaceFrame } from './story-frame.ts';

const GROUP_NAMES: Record<StageGroup, string> = {
  ready: 'Ready',
  working: 'Working',
  'in-review': 'In review',
  merged: 'Merged',
};

const meta = {
  title: 'Components/StageDot',
  component: StageDot,
  decorators: [surfaceFrame],
  args: { group: 'ready' },
  render: ({ group }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <StageDot group={group} />
      {GROUP_NAMES[group]}
    </span>
  ),
} satisfies Meta<typeof StageDot>;

export default meta;

type Story = StoryObj<typeof meta>;

function groupStory(group: StageGroup): Story {
  return {
    args: { group },
    play: async ({ canvasElement }) => {
      const dot = canvasElement.querySelector<HTMLElement>(
        `[data-group="${group}"]`,
      );
      await expect(dot).toHaveAttribute('aria-hidden', 'true');
      await expect(dot).toHaveTextContent('');
      await expect(dot).toHaveStyle({
        width: '8px',
        height: '8px',
        borderRadius: '50%',
      });
      await expect(dot?.style.background).toBe(STAGE_GROUP_COLORS[group]);
    },
  };
}

export const Ready = groupStory('ready');
export const Working = groupStory('working');
export const InReview = groupStory('in-review');
export const Merged = groupStory('merged');
