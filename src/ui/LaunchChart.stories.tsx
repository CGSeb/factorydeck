import type { Meta, StoryObj } from '@storybook/react-vite';
import { LaunchChart } from './LaunchChart.tsx';
import { writeSpecDetail } from './skill-fixtures.ts';

const meta = {
  component: LaunchChart,
} satisfies Meta<typeof LaunchChart>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ThreeDays: Story = {
  args: { series: writeSpecDetail.series },
};
