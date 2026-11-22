import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { Aside } from './Aside.tsx';

const meta = {
  component: Aside,
  args: {
    children: [
      <p key="state">State: in review</p>,
      <p key="rounds">Review rounds: 2</p>,
      <p key="branch">Branch: feat/042-export</p>,
    ],
  },
  decorators: [
    (Story) => (
      <div style={{ width: 320, fontSize: 'var(--fd-text-md)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Aside>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ThreeBlocks: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('.fd-aside > p')).toHaveLength(
      3,
    );
  },
};
