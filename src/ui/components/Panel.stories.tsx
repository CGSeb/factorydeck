import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Panel } from './Panel.tsx';

const meta = {
  component: Panel,
  args: { children: <p style={{ margin: 0 }}>Three features merged today.</p> },
  decorators: [
    (Story) => (
      <div style={{ background: 'var(--fd-page)', padding: 24 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Panel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithHeadingAndLink: Story = {
  args: {
    heading: 'Recent activity',
    link: { label: 'All sessions', href: '/sessions' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('region', { name: 'Recent activity' }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('heading', { level: 2, name: 'Recent activity' }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('link', { name: 'All sessions' }),
    ).toHaveAttribute('href', '/sessions');
  },
};

export const WithoutHeading: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('heading')).toBeNull();
  },
};
