import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { type ReactNode, useEffect, useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { RefreshControl } from './RefreshControl.tsx';
import { Sidebar } from './Sidebar.tsx';
import { NARROW_QUERY } from './sidebar-state.ts';
import {
  expectDrawerClosed,
  expectFolded,
  openDrawer,
  withStoredFold,
} from './sidebar-stories.ts';

const SOURCE_URL = 'https://github.com/CGSeb/factorydeck';
const LINK_NAME = 'FactoryDeck on GitHub';

function NarrowWindow({ children }: { children: ReactNode }): ReactNode {
  const [original] = useState(() => {
    const matchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query) =>
      matchMedia(query === NARROW_QUERY ? '(min-width: 0px)' : query);
    return matchMedia;
  });
  useEffect(
    () => () => {
      window.matchMedia = original;
    },
    [original],
  );
  return <div style={{ maxWidth: 360 }}>{children}</div>;
}

const frame: Decorator = (Story) => (
  <div style={{ display: 'flex', height: 560, background: 'var(--fd-page)' }}>
    <Story />
  </div>
);

async function expectSourceLink(link: HTMLElement): Promise<void> {
  await expect(link).toHaveAttribute('href', SOURCE_URL);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noreferrer');
  await expect(link.querySelector('[data-icon="github"]')).not.toBeNull();
}

const meta = {
  title: 'Components/Sidebar credit',
  component: Sidebar,
  args: {
    links: [
      { label: 'Overview', icon: 'overview', href: '#overview', current: true },
      { label: 'Roles', icon: 'roles', href: '#roles', current: false },
    ],
    refresh: {
      tip: 'Issues not collected yet',
      render: (compact) => (
        <RefreshControl
          collectedAt={null}
          now={new Date('2026-01-10T12:00:00Z')}
          refreshing={false}
          onRefresh={fn()}
          compact={compact}
        />
      ),
    },
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Sidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ExpandedWithCredit: Story = {
  decorators: [frame, withStoredFold(undefined)],
  play: async ({ canvasElement }) => {
    const sidebar = within(canvasElement).getByRole('complementary');
    const link = within(sidebar).getByRole('link', { name: LINK_NAME });
    await expectSourceLink(link);
    await expect(link).toHaveTextContent('GitHub');
    const line = link.parentElement;
    await expect(line).toHaveTextContent('Open source · by CGSeb GitHub');
    await expect(sidebar.lastElementChild?.lastElementChild).toBe(line);
  },
};

export const FoldedCreditTooltip: Story = {
  decorators: [frame, withStoredFold('collapsed')],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expectFolded(canvasElement, true);
    await expect(canvas.queryByText('Open source · by CGSeb')).toBeNull();
    const link = canvas.getByRole('link', { name: LINK_NAME });
    await expectSourceLink(link);
    link.focus();
    await expect(link).toHaveFocus();
    await expect(
      await canvas.findByRole('tooltip', { hidden: true }),
    ).toHaveTextContent('Open source · by CGSeb on GitHub');
  },
};

export const DrawerWithCredit: Story = {
  decorators: [
    (Story) => (
      <NarrowWindow>
        <Story />
      </NarrowWindow>
    ),
    withStoredFold('collapsed'),
  ],
  play: async ({ canvasElement }) => {
    await openDrawer(canvasElement);
    const drawer = within(canvasElement).getByRole('dialog');
    await expect(drawer).toHaveTextContent('Open source · by CGSeb');
    const link = within(drawer).getByRole('link', { name: LINK_NAME });
    await expectSourceLink(link);
    link.addEventListener('click', (event) => {
      event.preventDefault();
    });
    await userEvent.click(link);
    await expectDrawerClosed(canvasElement);
  },
};
