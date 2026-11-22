import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { RoundsBadge } from './RoundsBadge.tsx';
import { surfaceFrame } from './story-frame.ts';

const meta = {
  title: 'Components/RoundsBadge',
  component: RoundsBadge,
  decorators: [surfaceFrame],
  args: { rounds: 1 },
} satisfies Meta<typeof RoundsBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

function roundsStory(rounds: number, inReview: boolean, text: string): Story {
  return {
    args: { rounds, inReview },
    play: async ({ canvasElement }) => {
      await expect(within(canvasElement).getByText(text)).toHaveAttribute(
        'data-tone',
        inReview ? 'warning' : 'neutral',
      );
    },
  };
}

export const InReviewOneRound = roundsStory(1, true, 'round 1');
export const InReviewThreeRounds = roundsStory(3, true, 'round 3');
export const MergedOneRound = roundsStory(1, false, '1 review round');
export const MergedThreeRounds = roundsStory(3, false, '3 review rounds');
