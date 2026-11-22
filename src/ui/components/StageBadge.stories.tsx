import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import type { IssueStage } from '../../git-host/types.ts';
import { STAGE_BADGES, StageBadge } from './StageBadge.tsx';
import { surfaceFrame } from './story-frame.ts';

const meta = {
  title: 'Components/StageBadge',
  component: StageBadge,
  decorators: [surfaceFrame],
  args: { stage: 'merged' },
} satisfies Meta<typeof StageBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

function stageStory(stage: IssueStage): Story {
  const { text, tone } = STAGE_BADGES[stage];
  return {
    args: { stage },
    play: async ({ canvasElement }) => {
      const badge = within(canvasElement).getByText(text);
      await expect(badge).toHaveAttribute('data-tone', tone);
      await expect(badge.style.background).toBe(`var(--fd-${tone}-bg)`);
      await expect(badge.style.color).toBe(`var(--fd-${tone})`);
    },
  };
}

export const Merged = stageStory('merged');
export const MergedByAPerson = stageStory('merged-by-person');
export const ClosedWithoutMerge = stageStory('closed');
export const Blocked = stageStory('blocked');
export const NeedsSpec = stageStory('needs-spec');
export const InReview = stageStory('in-review');
export const Working = stageStory('working');
export const Ready = stageStory('ready');
export const Open = stageStory('open');
