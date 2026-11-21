import type { Meta, StoryObj } from '@storybook/react-vite';
import { CostChart } from './CostChart.tsx';
import { todayOverview, weekOverview } from './fixtures.ts';

const meta = { component: CostChart } satisfies Meta<typeof CostChart>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PerDay: Story = {
  args: { bucket: weekOverview.bucket, series: weekOverview.series },
};

export const PerHour: Story = {
  args: { bucket: todayOverview.bucket, series: todayOverview.series },
};
