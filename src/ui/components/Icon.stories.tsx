import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { ICON_NAMES, Icon } from './Icon.tsx';
import { surfaceFrame } from './story-frame.ts';

const meta = {
  component: Icon,
  args: { name: 'overview' },
  decorators: [surfaceFrame],
} satisfies Meta<typeof Icon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EveryIcon: Story = {
  render: () => (
    <ul
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--fd-space-6)',
        margin: 0,
        padding: 0,
        listStyle: 'none',
      }}
    >
      {ICON_NAMES.map((name) => (
        <li
          key={name}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--fd-space-2)',
            width: 72,
            color: 'var(--fd-ink-2)',
            fontSize: 'var(--fd-text-xs)',
          }}
        >
          <Icon name={name} />
          {name}
        </li>
      ))}
    </ul>
  ),
  play: async ({ canvasElement }) => {
    const items = within(canvasElement).getAllByRole('listitem');
    await expect(items.map((item) => item.textContent)).toEqual([
      'overview',
      'features',
      'bugs',
      'stats',
      'frictions',
      'sessions',
      'skills',
      'roles',
      'team',
      'more',
      'collapse',
      'expand',
      'chevron',
      'menu',
      'close',
      'project',
      'monitor',
      'sun',
      'moon',
      'sign-out',
      'refresh',
      'info',
      'github',
    ]);
    for (const svg of canvasElement.querySelectorAll('svg')) {
      await expect(svg).toHaveAttribute('aria-hidden', 'true');
      await expect(svg).toHaveAttribute('width', '20');
      await expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    }
  },
};
