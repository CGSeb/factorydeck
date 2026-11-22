import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { NO_TIP, SidebarPanel } from './SidebarPanel.tsx';

const meta = {
  component: SidebarPanel,
  args: {
    links: [
      { label: 'Overview', icon: 'overview', href: '#overview', current: true },
      { label: 'Roles', icon: 'roles', href: '#roles', current: false },
    ],
    folded: false,
    tipFor: NO_TIP,
    projectSlot: null,
  },
  decorators: [
    (Story) => (
      <div style={{ display: 'flex', height: 360 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SidebarPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Expanded: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('link', { name: 'Overview' }),
    ).toHaveAttribute('aria-current', 'page');
  },
};

export const Folded: Story = {
  args: { folded: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('complementary')).toHaveTextContent(
      'FactoryDeck',
    );
    await expect(canvas.getByRole('link', { name: 'Roles' })).toBeVisible();
  },
};
