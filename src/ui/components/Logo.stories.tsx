import type { Meta, StoryObj } from '@storybook/react-vite';
import { Logo } from './Logo.tsx';
import { surfaceFrame } from './story-frame.ts';

const meta = {
  component: Logo,
  decorators: [surfaceFrame],
} satisfies Meta<typeof Logo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithLabel: Story = {
  render: () => (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--fd-space-2)',
      }}
    >
      <Logo />
      FactoryDeck
    </span>
  ),
};
