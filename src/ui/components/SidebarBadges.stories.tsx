import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import type { IconName } from './Icon.tsx';
import { Sidebar, type SidebarLink } from './Sidebar.tsx';
import {
  inNarrowWindow,
  openDrawer,
  withStoredFold,
} from './sidebar-stories.ts';

const SECTIONS: readonly [string, IconName][] = [
  ['Overview', 'overview'],
  ['Features', 'features'],
  ['Bugs', 'bugs'],
  ['Stats', 'stats'],
  ['Sessions', 'sessions'],
];

interface Ready {
  feature: number;
  bug?: number | undefined;
  current?: string;
}

function links({ feature, bug, current = 'Overview' }: Ready): SidebarLink[] {
  return SECTIONS.filter(
    ([label]) => bug !== undefined || label !== 'Bugs',
  ).map(([label, icon]) => ({
    label,
    icon,
    href: `#${label.toLowerCase()}`,
    current: label === current,
    badge:
      label === 'Features'
        ? { count: feature, tone: 'neutral' }
        : label === 'Bugs' && bug !== undefined
          ? { count: bug, tone: 'danger' }
          : undefined,
  }));
}

function stored(fold: string | undefined): Decorator[] {
  return [
    (Story) => (
      <div
        style={{ display: 'flex', height: 480, background: 'var(--fd-page)' }}
      >
        <Story />
      </div>
    ),
    withStoredFold(fold),
  ];
}

function badges(canvasElement: HTMLElement): (string | null)[] {
  return [
    ...canvasElement.querySelectorAll(
      '.fd-sidebar-badge, .fd-sidebar-pastille',
    ),
  ].map((badge) => badge.textContent);
}

const meta = {
  component: Sidebar,
  args: { links: links({ feature: 3, bug: 2 }) },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Sidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ExpandedWithBothBadges: Story = {
  decorators: stored(undefined),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const features = canvas.getByRole('link', { name: 'Features, 3 ready' });
    const bugs = canvas.getByRole('link', { name: 'Bugs, 2 ready' });
    await expect(features).toHaveTextContent('Features3');
    await expect(bugs).toHaveTextContent('Bugs2');
    await expect(
      bugs.querySelector('.fd-sidebar-badge[data-tone="danger"]'),
    ).toHaveAttribute('aria-hidden', 'true');
    await expect(
      features.querySelector('.fd-sidebar-badge[data-tone="neutral"]'),
    ).toHaveAttribute('aria-hidden', 'true');
    await expect(canvas.getByRole('link', { name: 'Stats' })).toBeVisible();
  },
};

export const FoldedWithBothPastilles: Story = {
  decorators: stored('collapsed'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(badges(canvasElement)).toEqual(['3', '2']);
    await expect(
      canvasElement.querySelectorAll(
        '.fd-sidebar-link-icon .fd-sidebar-pastille',
      ),
    ).toHaveLength(2);
    await userEvent.hover(canvas.getByRole('link', { name: 'Bugs, 2 ready' }));
    await expect(
      await canvas.findByRole('tooltip', { hidden: true }),
    ).toHaveTextContent('Bugs · 2 ready');
    await userEvent.hover(canvas.getByRole('link', { name: 'Stats' }));
    await expect(
      canvas.getByRole('tooltip', { hidden: true }),
    ).toHaveTextContent(/^Stats$/);
  },
};

export const CountAbove99: Story = {
  decorators: stored(undefined),
  args: { links: links({ feature: 124, bug: 100 }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(badges(canvasElement)).toEqual(['99+', '99+']);
    await expect(
      canvas.getByRole('link', { name: 'Features, 124 ready' }),
    ).toBeVisible();
  },
};

export const FoldedCountAbove99: Story = {
  args: { links: links({ feature: 124, bug: 7 }) },
  decorators: stored('collapsed'),
  play: async ({ canvasElement }) => {
    await expect(badges(canvasElement)).toEqual(['99+', '7']);
  },
};

export const BothCountsZero: Story = {
  decorators: stored(undefined),
  args: { links: links({ feature: 0, bug: 0 }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(badges(canvasElement)).toEqual([]);
    await expect(canvas.getByRole('link', { name: 'Features' })).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Bugs' })).toBeVisible();
  },
};

export const FoldedBothCountsZero: Story = {
  args: { links: links({ feature: 0, bug: 0 }) },
  decorators: stored('collapsed'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(badges(canvasElement)).toEqual([]);
    await userEvent.hover(canvas.getByRole('link', { name: 'Features' }));
    await expect(
      await canvas.findByRole('tooltip', { hidden: true }),
    ).toHaveTextContent(/^Features$/);
  },
};

export const WithoutBugTickets: Story = {
  decorators: stored(undefined),
  args: { links: links({ feature: 5 }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(badges(canvasElement)).toEqual(['5']);
    await expect(canvas.queryByRole('link', { name: /^Bugs/ })).toBeNull();
    await expect(
      canvas.getByRole('link', { name: 'Features, 5 ready' }),
    ).toBeVisible();
  },
};

export const HighlightedLinkWithBadge: Story = {
  decorators: stored(undefined),
  args: { links: links({ feature: 1, bug: 4, current: 'Bugs' }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('link', { name: 'Bugs, 4 ready' }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      canvas.getByRole('link', { name: 'Features, 1 ready' }),
    ).not.toHaveAttribute('aria-current');
  },
};

export const DrawerWithBadges: Story = {
  decorators: [inNarrowWindow, withStoredFold('collapsed')],
  play: async ({ canvasElement }) => {
    await openDrawer(canvasElement);
    const drawer = within(within(canvasElement).getByRole('dialog'));
    await expect(
      drawer.getByRole('link', { name: 'Features, 3 ready' }),
    ).toBeInTheDocument();
    await expect(
      drawer.getByRole('link', { name: 'Bugs, 2 ready' }),
    ).toBeInTheDocument();
    await expect(badges(canvasElement)).toEqual(['3', '2']);
    await expect(
      canvasElement.querySelectorAll('.fd-sidebar-badge'),
    ).toHaveLength(2);
  },
};
