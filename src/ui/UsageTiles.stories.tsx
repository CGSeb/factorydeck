import type { Meta, StoryObj } from '@storybook/react-vite';
import { unknownPricesOverview, weekOverview } from './fixtures.ts';
import { UsageTiles } from './UsageTiles.tsx';

const meta = { component: UsageTiles } satisfies Meta<typeof UsageTiles>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Totals: Story = { args: { totals: weekOverview.totals } };

export const UnknownPrices: Story = {
  args: { totals: unknownPricesOverview.totals },
};
