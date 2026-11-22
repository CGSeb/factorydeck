import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import type { SessionState } from '../../sessions/types.ts';
import {
  SESSION_STATE_BADGES,
  SessionStateBadge,
} from './SessionStateBadge.tsx';
import { surfaceFrame } from './story-frame.ts';

const meta = {
  title: 'Components/SessionStateBadge',
  component: SessionStateBadge,
  decorators: [surfaceFrame],
  args: { state: 'working' },
} satisfies Meta<typeof SessionStateBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

function stateStory(state: SessionState): Story {
  const { text, tone, dot } = SESSION_STATE_BADGES[state];
  return {
    args: { state },
    play: async ({ canvasElement }) => {
      const badge = within(canvasElement).getByText(text);
      await expect(badge).toHaveAttribute('data-tone', tone);
      await expect(badge.style.background).toBe(`var(--fd-${tone}-bg)`);
      const marker = badge.querySelector<HTMLElement>('[aria-hidden="true"]');
      await expect(marker).toHaveStyle({ width: '7px', height: '7px' });
      await expect(marker?.style.background).toBe(dot);
    },
  };
}

export const Working = stateStory('working');
export const WaitingForYou = stateStory('waiting');
export const Inactive = stateStory('inactive');
