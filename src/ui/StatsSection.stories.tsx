import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { StatsSection } from './StatsSection.tsx';

const meta = {
  component: StatsSection,
  args: {
    title: 'Where the tokens went',
    children: <p>Three figures over the calls of the period.</p>,
  },
} satisfies Meta<typeof StatsSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Titled: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('region', { name: 'Where the tokens went' }),
    ).toBeVisible();
    await expect(
      canvas.getByRole('heading', { level: 3, name: 'Where the tokens went' }),
    ).toBeVisible();
  },
};
