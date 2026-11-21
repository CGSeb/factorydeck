import type { Meta, StoryObj } from '@storybook/react-vite';
import { TokenCount } from './TokenCount.tsx';

const meta = { component: TokenCount } satisfies Meta<typeof TokenCount>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Small: Story = { args: { value: 950 } };

export const Millions: Story = { args: { value: 12_400_000 } };
