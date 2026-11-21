import type { Meta, StoryObj } from '@storybook/react-vite';
import { unknownPricesOverview, weekOverview } from './fixtures.ts';
import { ModelTable } from './ModelTable.tsx';

const meta = { component: ModelTable } satisfies Meta<typeof ModelTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const KnownPrices: Story = { args: { models: weekOverview.models } };

export const UnknownPrice: Story = {
  args: { models: unknownPricesOverview.models },
};
