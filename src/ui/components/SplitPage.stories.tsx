import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Panel } from './Panel.tsx';
import { SplitPage } from './SplitPage.tsx';

const meta = {
  component: SplitPage,
  args: {
    children: (
      <Panel heading="Sessions">
        <p style={{ margin: 0 }}>Four sessions worked on this feature.</p>
      </Panel>
    ),
    aside: [
      <p key="state">State: in review</p>,
      <p key="rounds">Review rounds: 2</p>,
    ],
  },
} satisfies Meta<typeof SplitPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Wide: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 1200 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('region', { name: 'Sessions' }),
    ).toBeInTheDocument();
    await expect(within(canvasElement).getByText('State: in review')).toBe(
      canvasElement.querySelector('.fd-aside > p'),
    );
  },
};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
};
